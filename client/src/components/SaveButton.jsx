// A bookmark (the save icon) used on the card and in the modal: an outline until saved, then filled green.
// save is { status, error } from Feed, or undefined if not saved yet
export default function SaveButton({ save, onSave }) {
  const status = save?.status;
  const saved = status === "saved";
  const label = saved ? "Saved" : status === "saving" ? "Saving…" : "Save";

  const handleClick = (event) => {
    // On a card, stop the click reaching the card itself, which would open the modal and record a view
    event.stopPropagation();
    onSave();
  };

  return (
    <div className="save">
      {/* The icon has no text, so aria-label and title say what the button does */}
      <button className={`save-icon ${saved ? "saved" : ""}`} disabled={status === "saving" || saved} onClick={handleClick} aria-label={label} title={label}>
        <SaveIcon />
      </button>
      {status === "error" && <p className="error">{save.error}</p>}
    </div>
  );
}

// Drawn inline so no icon library is needed; CSS decides whether it's an outline or filled
function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
