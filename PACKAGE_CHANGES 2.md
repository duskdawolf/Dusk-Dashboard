# Package changes for v26 Alpha 7

Install the compositor if it is not already present:

```bash
npm install sharp
```

The feature also uses the packages already expected by v26:

```bash
npm install openai @supabase/supabase-js @supabase/ssr
```

Why `sharp` exists here:

- OpenAI generates the themed background artwork.
- `sharp` composites a deterministic SVG layer on top.
- Event names, dates, locations, route labels, and find-me copy remain exact instead of depending on generated-image typography.

The final generated size is **1152x2048**, an exact 9:16 ratio with both edges divisible by 16.
