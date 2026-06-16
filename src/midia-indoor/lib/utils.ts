import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);
}

export function formatCurrency(value: number, locale = "pt-BR", currency = "BRL") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

export function formatDate(date: string | Date, locale = "pt-BR") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

export function formatDateTime(date: string | Date, locale = "pt-BR") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function whatsappLink(phone: string, message?: string) {
  const clean = phone.replace(/\D/g, "");
  const base = `https://wa.me/${clean.startsWith("55") ? clean : `55${clean}`}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function buildUtmUrl(
  baseUrl: string,
  utm: { source: string; medium?: string; campaign?: string; content?: string; term?: string },
) {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", utm.source);
  if (utm.medium) url.searchParams.set("utm_medium", utm.medium);
  if (utm.campaign) url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  if (utm.term) url.searchParams.set("utm_term", utm.term);
  return url.toString();
}
