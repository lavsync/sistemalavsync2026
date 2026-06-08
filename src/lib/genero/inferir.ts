// LavSync · Inferência de gênero pelo primeiro nome (PT-BR)
//
// Estratégia em camadas (do mais preciso pro mais heurístico):
// 1. Lista de nomes BR mais comuns com gênero conhecido (~400 nomes)
// 2. Lista de exceções (nomes ambíguos / unisex / contra-intuitivos)
// 3. Heurística por terminação (final -a feminino, -o masculino, etc)
// 4. Null quando não tem confiança

export type Genero = "Masculino" | "Feminino";

/** Pega primeiro nome (palavra antes do primeiro espaço) e normaliza. */
export function primeiroNome(nomeCompleto: string): string {
  if (!nomeCompleto) return "";
  const partes = nomeCompleto.trim().split(/\s+/);
  return partes[0]
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

// ─── Lista de nomes masculinos mais comuns BR ───────────────────────
const NOMES_MASCULINOS = new Set<string>([
  "alexandre", "alex", "alan", "allan", "andre", "anderson", "antonio", "arthur", "augusto",
  "bernardo", "bruno", "breno", "benjamin", "benicio", "bento", "bruno",
  "caio", "carlos", "cesar", "cassio", "celso", "claudio", "cristiano", "cauã", "caua", "cauê",
  "daniel", "danilo", "davi", "david", "diego", "douglas", "denis", "dennys", "dario", "deyvid",
  "edson", "eduardo", "eliseu", "elias", "emanuel", "emerson", "enzo", "erick", "eric", "everton", "ezequiel",
  "fabiano", "fabio", "felipe", "fernando", "filipe", "francisco", "frederico", "fred",
  "gabriel", "geraldo", "george", "gilberto", "giovanni", "gustavo", "guilherme", "gilmar", "gabryel",
  "heitor", "henrique", "hugo", "hudson", "hilton", "humberto",
  "igor", "ivan", "ismael", "isaque", "italo", "ivo",
  "jacó", "jaco", "jairo", "jair", "jefferson", "jeferson", "jesse", "joão", "joao", "joaquim", "jonas", "jonathan",
  "jorge", "jose", "josé", "josias", "juan", "julio", "júlio", "junior", "julian", "juvenal",
  "kaique", "kaian", "kayke", "kayky", "kauã", "kaua", "kauê", "kalil", "khaian", "kevin",
  "leandro", "leonardo", "leonel", "lourenço", "lucas", "luiz", "luis", "luan", "lucca", "luiz",
  "marcelo", "marcos", "marcio", "márcio", "mario", "mario", "mateus", "matheus", "matias", "maurice", "mauricio", "miguel", "moises", "moisés", "murilo",
  "nathan", "natanael", "nelson", "nicolas", "noé", "noe",
  "octavio", "oscar", "otavio", "otávio", "oswaldo",
  "pablo", "paulo", "pedro", "phelipe", "pierre", "phillip", "phillipe",
  "rafael", "raphael", "raul", "ramon", "renato", "renan", "renê", "rene", "ricardo", "rick", "richard",
  "roberto", "robson", "rodolfo", "rodrigo", "rogerio", "rogério", "rolando", "romario", "ronaldo",
  "ronaldo", "ronan", "rui", "ruan",
  "samuel", "sandro", "santiago", "sebastiao", "sergio", "sergio", "silvio", "simão", "simao", "stefan", "sidnei", "sidney",
  "talles", "tales", "tassio", "thales", "thiago", "tiago", "thomas", "tomaz", "tomás", "túlio", "tulio",
  "ubirajara", "ulisses", "ulysses",
  "valdir", "valter", "valdo", "vinicius", "vinícius", "victor", "vitor", "viny",
  "wagner", "wallace", "walter", "washington", "welson", "wesley", "wellington", "william", "willian", "wilson",
  "xavier",
  "yago", "yan", "yago", "yuri",
  "zé", "ze", "zaqueu",
  // Comuns recentes/raros mas usados
  "gedeon", "fabricio", "fabrício", "deyvid", "djair", "djalma",
]);

// ─── Lista de nomes femininos mais comuns BR ────────────────────────
const NOMES_FEMININOS = new Set<string>([
  "adriana", "adriane", "adrielle", "agatha", "ágatha", "agda", "aida", "alana", "alaides", "alane",
  "alessandra", "alexandra", "alice", "alicia", "alícia", "aline", "amanda", "amelia", "amélia",
  "amabile", "ana", "anabel", "anastacia", "andrea", "andréa", "andreia", "andréia", "andressa",
  "angela", "ângela", "angelica", "angélica", "antonia", "antônia", "apolonia", "ariane", "arlete",
  "barbara", "bárbara", "beatriz", "belisa", "beth", "bianca", "bruna",
  "camila", "carla", "carmen", "carolina", "carolaine", "carol", "catarina", "catia", "cátia",
  "celia", "célia", "cecilia", "cecília", "chayane", "christine", "cibele", "cintia", "cínthia", "claudia", "cláudia",
  "claudete", "cleuza", "cleo", "clemencia", "cristiana", "cristiane", "cristina",
  "dafne", "dagmar", "daiana", "daiane", "daniela", "dânielle", "danielle", "daniella", "deborah", "débora", "debora",
  "deise", "denise", "diana", "dione", "djanira", "dora", "doris", "dóris", "dulce", "denize",
  "edileia", "edilene", "edna", "edinéa", "edith", "elaine", "eliana", "eliane", "elisangela",
  "elisete", "elizabete", "elizabeth", "elke", "ellen", "elen", "eloah", "eloisa", "ema", "ema",
  "emanuela", "emanuelle", "emily", "emilly", "emília", "erika", "érica", "erica",
  "estela", "estefany", "esther", "ester", "eunice", "eva", "evelyn", "ewelyn",
  "fabiana", "fabiane", "fátima", "fatima", "fernanda", "flávia", "flavia", "flora", "francisca",
  "gabriela", "gabriella", "geni", "geraldina", "giane", "gilda", "giovana", "gioconda", "giulia", "giullia",
  "gisele", "gizele", "gizelda", "gisela", "glaucia", "gláucia", "glória", "gloria", "graziele", "graziela",
  "hagatha", "hadassa", "hanna", "hannah", "heliane", "helena", "heloisa", "helma", "hilda",
  "iara", "iasmin", "ieda", "ilana", "ilda", "indira", "ines", "inês", "ingrid", "ione", "iracema",
  "iraci", "irene", "iris", "íris", "isabel", "isabela", "isabella", "isabelle", "isadora", "isaura", "isis",
  "ivana", "ivani", "ivete", "izabela", "izabella",
  "jacira", "jaira", "janaina", "janaína", "jane", "janete", "janice", "janne", "jasmim", "jaqueline", "jaque",
  "jeniffer", "jenifer", "jennifer", "jennyfer", "jenny", "jesica", "jéssica", "jessica", "joana", "joice",
  "josefa", "josefina", "josi", "josiane", "joyce", "juçara", "juçara", "juliana", "julia", "júlia",
  "juliene", "juliete", "julieta", "junia", "júnia", "jurema", "kethleen",
  "karen", "karina", "karla", "kathleen", "kátia", "katia", "katiane", "katyusca", "keila", "kelly", "kely", "ketlen",
  "lais", "laís", "lara", "larissa", "laura", "laysa", "lavinia", "lavínia", "leda", "léa", "leandra", "leila",
  "lenita", "leoni", "leticia", "letícia", "lia", "liana", "liane", "lice", "lidia", "lídia", "ligia",
  "lilia", "lília", "liliam", "liliana", "liliane", "lina", "linda", "lindalva", "lis", "lisete", "livia",
  "lívia", "loiva", "lorena", "loriane", "lorraine", "lorrayne", "louise", "lourdes", "lucia", "lúcia",
  "luana", "luiza", "luísa", "luisa", "luma",
  "madalena", "magali", "magda", "manoela", "manuela", "manuelly", "marcela", "marcia", "márcia",
  "margareth", "margarida", "margarete", "marlene", "maria", "mariana", "marina", "marisa", "marlene",
  "marta", "martha", "matilde", "maura", "mauricia", "maysa", "mayara", "melissa", "melyssa",
  "mercedes", "michele", "michelle", "milene", "milena", "milla", "miriam", "miryan", "monica", "mônica",
  "naiara", "naila", "natalia", "natália", "natasha", "neli", "nelma", "neusa", "neuza", "nilda", "nilza",
  "nicole", "noelia", "noemi", "nora", "norma", "nubia", "núbia",
  "odete", "olga", "olinda", "ondina", "ofélia",
  "pamela", "pâmela", "patricia", "patrícia", "paula", "paulina", "penha", "petra", "polly", "priscila", "priscilla",
  "quesia", "quezia",
  "rafaela", "rafaella", "raissa", "raíssa", "raniela", "raquel", "rayane", "rayanne", "rebeca", "regina", "renata",
  "rita", "robertinha", "roberta", "ronielly", "rosa", "rosana", "rosane", "rosangela", "rosani", "rosaria",
  "roseli", "roseane", "rosenir", "rosilene", "rosineide", "rosineide", "ruth",
  "sabrina", "salete", "sandra", "samira", "sara", "sarah", "selma", "sharon", "sheila", "sheyla", "sibele",
  "silvana", "silvia", "sílvia", "simone", "sirlei", "sirlene", "solange", "sonia", "sônia", "soraia", "soraya",
  "stefani", "stefany", "stephanie", "stephany", "suelen", "suellen", "suely", "sueli", "sumaya", "susane", "susy",
  "tamara", "tamires", "tania", "tânia", "tatiana", "tatiane", "tayane", "tayara", "teresa", "teresinha", "terezinha",
  "tatianny", "tati",
  "uiara",
  "valeria", "valéria", "valentina", "valdira", "valdirene", "valdete", "vanderlei", "vanessa", "vania", "vânia", "vera", "veridiana",
  "vilma", "vinicia", "virginia", "vírginia", "vitoria", "vitória", "viviane", "vivian",
  "wanda", "wanderleia", "wandeise", "weslayne", "wilma",
  "xenia", "xênia",
  "yara", "yasmin", "yasmim", "yedda", "yola", "ysadora", "yvette",
  "zenaide", "zilda", "zoe", "zuleide", "zulmira",
]);

// ─── Exceções (unisex / contra-intuitivos) ──────────────────────────
// Aqui ficam nomes que terminam em "a" mas são masculinos, ou vice-versa.
const EXCECOES_MASCULINAS = new Set<string>([
  "andrea", // unisex no BR antigo, mas predominante feminino → mantém F
  "ariel", "calebe", "noé", "noe", "thoma", "thomas", "tomas", "tomás",
  "vinícius", "vinicius", "elias", "tobias",
  // Nomes terminados em -a que são masculinos
  "jeremias", "matias", "isaias", "isaías",
  "andre", "andré", "alexandre", "neto", "akira",
]);

const EXCECOES_FEMININAS = new Set<string>([
  // Nomes terminados em consoante/-o que são femininos
  "carmen", "carmem", "miriam", "myriam", "kethellen", "ester", "esther",
  "elisabeth", "raquel", "isabel", "yasmin", "yasmim", "ingrid",
]);

// ─── Heurística por terminação ─────────────────────────────────────
function inferirPorTerminacao(nome: string): Genero | null {
  const n = nome.toLowerCase();
  if (n.length < 3) return null;

  // Femininos: -a, -ana, -ina, -ela, -ina, -ice, -ette
  if (n.endsWith("a") && !["a", "ea", "oa", "ua"].includes(n.slice(-2))) {
    return "Feminino"; // termina em -a (clara, joana, maria)
  }
  if (/(ana|ina|ela|ila|ona|una|essa|isse|elle|ette|nce|nice|trice)$/.test(n)) {
    return "Feminino";
  }
  // Masculinos: -o, -el, -al, -ar, -er, -or, -son, -ton, -ar
  if (n.endsWith("o") && !["ão", "eo"].includes(n.slice(-2))) {
    return "Masculino"; // pedro, paulo, marcelo
  }
  if (/(son|ton|ard|aldo|berto|ino|inho|alho|ardo)$/.test(n)) {
    return "Masculino";
  }
  if (/(eu|ay|el|ar|or)$/.test(n)) {
    return "Masculino";
  }
  return null;
}

/** Função principal. Retorna gênero ou null se não há confiança. */
export function inferirGenero(nomeCompleto: string | null | undefined): Genero | null {
  if (!nomeCompleto) return null;
  const primeiro = primeiroNome(nomeCompleto);
  if (!primeiro || primeiro.length < 2) return null;

  // 1. Lista de nomes conhecidos (alta confiança)
  if (EXCECOES_MASCULINAS.has(primeiro)) return "Masculino";
  if (EXCECOES_FEMININAS.has(primeiro)) return "Feminino";
  if (NOMES_MASCULINOS.has(primeiro)) return "Masculino";
  if (NOMES_FEMININOS.has(primeiro)) return "Feminino";

  // 2. Heurística por terminação
  return inferirPorTerminacao(primeiro);
}

/** Estatística sobre uma lista de nomes — útil pra UI mostrar confiança */
export function estatisticasInferencia(nomes: string[]): {
  total: number; masculino: number; feminino: number; indeterminado: number;
} {
  const stats = { total: nomes.length, masculino: 0, feminino: 0, indeterminado: 0 };
  for (const n of nomes) {
    const g = inferirGenero(n);
    if (g === "Masculino") stats.masculino++;
    else if (g === "Feminino") stats.feminino++;
    else stats.indeterminado++;
  }
  return stats;
}
