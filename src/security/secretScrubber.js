const SECRET_PATTERNS = [
  // JWT tokens
  {
    regex: /eyJh[a-zA-Z0-9_\-]{10,}\.eyJh[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}/g,
    replacement: '[REDACTED_JWT]'
  },
  // API key formats (sk-..., ghp_..., AKIA..., etc.)
  {
    regex: /\b(sk-[a-zA-Z0-9_\-]{20,})\b/g,
    replacement: '[REDACTED_API_KEY]'
  },
  {
    regex: /\b(ghp_[a-zA-Z0-9]{30,})\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]'
  },
  {
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacement: '[REDACTED_AWS_KEY]'
  },
  // Bearer authentication headers/tokens
  {
    regex: /(Bearer\s+)[a-zA-Z0-9\-._~+/]+=*/gi,
    replacement: '$1[REDACTED_TOKEN]'
  },
  // Database connection strings
  {
    regex: /((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/)[^:\s]+:[^@\s]+@/gi,
    replacement: '$1[REDACTED_CREDENTIALS]@'
  },
  // .env or assignment patterns like API_KEY = "xyz" or password: 'abc'
  {
    regex: /(?<=\b(?:password|passwd|secret|api_key|apikey|auth_token|access_token|private_key)\s*[:=]\s*["']?)(?!\[REDACTED)[^"'\s\r\n]{4,}(?=["']?)/gi,
    replacement: '[REDACTED]'
  },
  // Query parameters with secret values
  {
    regex: /([?&](?:api_key|token|access_token|key|secret)=)[^&\s]+/gi,
    replacement: '$1[REDACTED]'
  }
];

export function scrubSecrets(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let scrubbed = input;
  for (const { regex, replacement } of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(regex, replacement);
  }
  return scrubbed;
}
