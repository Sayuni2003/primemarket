// Used on the card and in the modal; save is { status, error } from Feed, or undefined if not saved yet
export default function SaveButton({ save, onSave }) {
  const status = save?.status;

  const handleClick = (event) => {
    // On a card, stop the click reaching the card itself, which would open the modal and record a view
    event.stopPropagation();
    onSave();
  };

  return (
    <div className="save">
      <button className={status === "saved" ? "saved" : ""} disabled={status === "saving" || status === "saved"} onClick={handleClick}>
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save"}
      </button>
      {status === "error" && <p className="error">{save.error}</p>}
    </div>
  );
}
