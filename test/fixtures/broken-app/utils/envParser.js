// test/fixtures/broken-app/utils/envParser.js
export function parseTimeout(envVar) {
  // Bug at line 4: Returns string without converting to integer and lacks fallback
  return envVar;
}
