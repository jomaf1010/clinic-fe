export function escapeUserHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function boldUserHtml(value: string | number): string {
  return `<b>${escapeUserHtml(value)}</b>`
}
