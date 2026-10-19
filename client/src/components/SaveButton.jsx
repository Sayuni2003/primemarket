// A heart used on the card and in the modal: an outline until saved, then filled red.
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
      <button className={`heart ${saved ? "saved" : ""}`} disabled={status === "saving" || saved} onClick={handleClick} aria-label={label} title={label}>
        <HeartIcon />
      </button>
      {status === "error" && <p className="error">{save.error}</p>}
    </div>
  );
}

// Drawn inline so no icon library is needed; CSS decides whether it's an outline or filled
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
