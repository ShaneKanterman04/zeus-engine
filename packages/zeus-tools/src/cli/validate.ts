export function runValidateCli(errors: string[] = []) {
  if (errors.length) {
    return {
      ok: false,
      output: errors.join("\n"),
    };
  }
  return {
    ok: true,
    output: "content-validation-ok",
  };
}
