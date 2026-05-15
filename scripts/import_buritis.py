#!/usr/bin/env python3
"""
LavSync · Importador de dados reais Buritis → Supabase
─────────────────────────────────────────────────────────
Lê os XLSX da unidade Buritis (Xô Varal) e popula:
  - public.maquinas  (totem + lavadoras descobertas em Vendas e Operação)
  - public.ciclos    (uma linha por venda — TOT10L-00/176246 / fluxo Vertipay+Stone)

Uso:
  SUPABASE_URL=https://yjesmmuoqrlteclwtfqn.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  python3 scripts/import_buritis.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests

# ─── CONFIG ──────────────────────────────────────────────────────────────────
SUPA_URL = os.environ["SUPABASE_URL"].rstrip("/")
SR_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TENANT_ID = "00000000-0000-0000-0000-000000000001"
BURITIS_UNIDADE_ID = "10000000-0000-0000-0000-000000000001"

XLSX_DIR = Path("/Users/danielqueiroz137/Desktop/relatorios unidade buritis xo varal")
VENDAS_FILES = [
    XLSX_DIR / "RELATÓRIO DE VENDAS BURITIS OUT-DEZ 2025.xlsx",
    XLSX_DIR / "RELATÓRIO DE VENDAS BURITIS JAN-MAIO 2026.xlsx",
]
OPERACAO_FILES = [
    XLSX_DIR / "RELATÓRIO OPERAÇÃO DAS MÁQUINAS OUT-DEZ 2025.xlsx",
    XLSX_DIR / "RELATÓRIO OPERAÇÃO DAS MÁQUINAS JAN-MAIO 2026.xlsx",
]

HEADERS = {
    "apikey": SR_KEY,
    "Authorization": f"Bearer {SR_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

# ─── HELPERS ─────────────────────────────────────────────────────────────────
def read_xlsx_with_header(path: Path, sheet: str, header_row: int) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet, header=header_row, engine="openpyxl")
    df = df.dropna(how="all")
    return df


def normalize_equipamento(raw: str) -> tuple[str, str]:
    """'TOT10L-00/176246 (B827EBDEC0AC)' → ('TOT10L-00/176246', 'totem')
       'Lavadora B L3' → ('Lavadora B L3', 'lavadora')
       'Secadora ...' → ('...', 'secadora')
    """
    if not isinstance(raw, str):
        return ("desconhecida", "totem")
    s = raw.strip()
    code = re.sub(r"\s*\([^)]*\)\s*$", "", s).strip()
    low = code.lower()
    if low.startswith("tot"):
        return (code, "totem")
    if "secadora" in low:
        return (code, "secadora")
    if "dobradora" in low:
        return (code, "dobradora")
    return (code, "lavadora")


def supa_post(path: str, body: list[dict[str, Any]] | dict[str, Any]) -> requests.Response:
    r = requests.post(f"{SUPA_URL}/rest/v1/{path}", headers=HEADERS, data=json.dumps(body, default=str))
    if not r.ok:
        print(f"ERROR {r.status_code} on {path}: {r.text[:500]}", file=sys.stderr)
    return r


def chunked(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


# ─── EXTRACT VENDAS ──────────────────────────────────────────────────────────
def extract_vendas() -> pd.DataFrame:
    frames = []
    for f in VENDAS_FILES:
        print(f"  · {f.name}")
        df = read_xlsx_with_header(f, "Vendas", header_row=10)
        df = df[df["Data da Venda"].notna()]
        df = df[df["Valor"].notna()]
        frames.append(df)
    out = pd.concat(frames, ignore_index=True)
    out["Data da Venda"] = pd.to_datetime(out["Data da Venda"], errors="coerce")
    out = out.dropna(subset=["Data da Venda"])
    return out


def extract_operacao_machines() -> set[str]:
    """Devolve códigos únicos de máquina vistos na operação."""
    machines: set[str] = set()
    for f in OPERACAO_FILES:
        print(f"  · {f.name}")
        df = read_xlsx_with_header(f, "Operação das Máquinas", header_row=11)
        # tenta achar coluna "Máquina"
        col = next((c for c in df.columns if str(c).strip().lower() == "máquina"), None)
        if col is None:
            print(f"    (sem coluna 'Máquina', cols: {list(df.columns)[:10]})")
            continue
        for v in df[col].dropna().astype(str).unique():
            machines.add(v.strip())
    return machines


# ─── UPSERT MÁQUINAS ─────────────────────────────────────────────────────────
def upsert_maquinas(codigos_tipos: list[tuple[str, str]]) -> dict[str, str]:
    """Upsert por (tenant_id, codigo). Retorna mapa codigo → maquina_id."""
    rows = [
        {
            "tenant_id": TENANT_ID,
            "unidade_id": BURITIS_UNIDADE_ID,
            "codigo": c,
            "tipo": t,
            "status": "ativa",
        }
        for c, t in codigos_tipos
    ]
    print(f"  upsertando {len(rows)} máquinas…")
    r = requests.post(
        f"{SUPA_URL}/rest/v1/maquinas?on_conflict=tenant_id,codigo",
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"},
        data=json.dumps(rows),
    )
    if not r.ok:
        print(f"  ERR {r.status_code}: {r.text[:500]}", file=sys.stderr)
        sys.exit(1)
    data = r.json()
    return {row["codigo"]: row["id"] for row in data}


# ─── INSERT CICLOS ───────────────────────────────────────────────────────────
def vendas_to_ciclos(vendas: pd.DataFrame, maquina_ids: dict[str, str]) -> list[dict[str, Any]]:
    ciclos = []
    skipped = 0
    for _, row in vendas.iterrows():
        equip_raw = row.get("Equipamento")
        if not isinstance(equip_raw, str):
            skipped += 1
            continue
        codigo, _tipo = normalize_equipamento(equip_raw)
        mid = maquina_ids.get(codigo)
        if not mid:
            skipped += 1
            continue
        try:
            valor = float(row["Valor"])
        except (TypeError, ValueError):
            skipped += 1
            continue
        dt = row["Data da Venda"].to_pydatetime()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        situacao = str(row.get("Situação", "")).lower()
        status = "concluido" if "sucesso" in situacao else "falhou"
        ciclos.append(
            {
                "tenant_id": TENANT_ID,
                "unidade_id": BURITIS_UNIDADE_ID,
                "maquina_id": mid,
                "iniciado_em": dt.isoformat(),
                "finalizado_em": dt.isoformat(),
                "valor": valor,
                "status": status,
            }
        )
    if skipped:
        print(f"  ! {skipped} vendas ignoradas (sem equipamento/valor)")
    return ciclos


def insert_ciclos(ciclos: list[dict[str, Any]]) -> int:
    if not ciclos:
        return 0
    total = 0
    for batch in chunked(ciclos, 500):
        r = supa_post("ciclos", batch)
        if r.ok:
            total += len(batch)
        else:
            sys.exit(1)
    return total


# ─── MAIN ────────────────────────────────────────────────────────────────────
def main() -> None:
    print("┌─ LavSync · Importador Buritis ─────────────────────────────────────")
    print(f"│ tenant: Xô Varal · unidade: Buritis ({BURITIS_UNIDADE_ID})")
    print(f"│ supabase: {SUPA_URL}")
    print("├─ 1/4 lendo Vendas")
    vendas = extract_vendas()
    print(f"│   → {len(vendas)} vendas válidas")

    print("├─ 2/4 descobrindo máquinas em Operação")
    op_machines = extract_operacao_machines()
    print(f"│   → {len(op_machines)} máquinas únicas em Operação")

    # Coletar todos os equipamentos (vendas + operação)
    codigos_tipos: dict[str, str] = {}
    for raw in vendas["Equipamento"].dropna().astype(str).unique():
        c, t = normalize_equipamento(raw)
        codigos_tipos[c] = t
    for raw in op_machines:
        c, t = normalize_equipamento(raw)
        codigos_tipos.setdefault(c, t)
    print(f"│   → {len(codigos_tipos)} máquinas no total para upsert")

    print("├─ 3/4 upsertando máquinas")
    maquina_ids = upsert_maquinas(list(codigos_tipos.items()))

    # Apaga ciclos antigos da unidade Buritis (idempotência)
    print("├─ 4/4 limpando ciclos antigos da unidade Buritis")
    r = requests.delete(
        f"{SUPA_URL}/rest/v1/ciclos?unidade_id=eq.{BURITIS_UNIDADE_ID}",
        headers={**HEADERS, "Prefer": "return=minimal"},
    )
    print(f"│   delete status: {r.status_code}")

    print("├─ inserindo ciclos a partir de Vendas")
    ciclos = vendas_to_ciclos(vendas, maquina_ids)
    n = insert_ciclos(ciclos)
    print(f"│   → {n} ciclos inseridos")

    print("└─ done.")


if __name__ == "__main__":
    main()
