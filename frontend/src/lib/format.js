export function formatAccountNumber(accountId) {
  if (!accountId) return "";
  return accountId.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function stripAccountNumber(value) {
  return (value || "").replace(/\s/g, "");
}
