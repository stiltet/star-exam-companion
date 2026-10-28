// Shows a product's names with the exam-guide name in bold. Text without ** markers is shown as it is.
export function Names({ text }: { text: string }) {
  if (!text.includes("**")) return <>{text}</>
  return (
    <span className="font-normal">
      {text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 === 1 ? <strong key={index} className="font-bold">{part}</strong> : part))}
    </span>
  )
}
