import { useMemo } from "react";

interface JsonViewProps {
  data: unknown;
}

// Lightweight JSON syntax highlighter using semantic Tailwind tokens.
// Avoids pulling a heavy dependency just for log inspection.
export function JsonView({ data }: JsonViewProps) {
  const html = useMemo(() => {
    const json = JSON.stringify(data, null, 2) ?? "null";
    const escaped = json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-blue-600 dark:text-blue-400"; // number
        if (/^"/.test(match)) {
          cls = /:$/.test(match)
            ? "text-foreground font-medium" // key
            : "text-green-600 dark:text-green-400"; // string
        } else if (/true|false/.test(match)) {
          cls = "text-purple-600 dark:text-purple-400";
        } else if (/null/.test(match)) {
          cls = "text-muted-foreground italic";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
  }, [data]);

  return (
    <pre
      className="bg-muted border border-border p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
