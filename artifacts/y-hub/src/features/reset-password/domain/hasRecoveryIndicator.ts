export function hasRecoveryIndicator(
  href: string,
  recoveryPreviouslySeen: boolean
): boolean {
  const url = new URL(href);

  const hash = new URLSearchParams(
    url.hash.replace(/^#/, '')
  );

  return (
    recoveryPreviouslySeen ||
    hash.get('type') === 'recovery' ||
    url.searchParams.has('code')
  );
}
