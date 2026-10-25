/** Preserve common technical identifiers that PostgreSQL splits at punctuation. */
export function normalizeTechnical(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/c\+\+/g, ' cpp ')
    .replace(/c#/g, ' csharp ')
    .replace(/\.env\b/g, ' dotenv ')
    .replace(/ci\s*\/\s*cd/g, ' cicd ')
    .replace(/node\.js/g, ' nodejs ')
    .replace(/promise\.all/g, ' promiseall ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
