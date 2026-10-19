import { useState } from "react";

// "Ayesha Fernando" → "AF"
const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// A form with one option per seeded user. There's no password: the app has no auth, it just remembers
// who you picked. The choice is only applied when the form is submitted
export default function UserPicker({ users, onSelect }) {
  const [choice, setChoice] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault(); // stop the browser reloading the page, the default for a form submit
    onSelect(choice);
  };

  return (
    <form className="picker" onSubmit={handleSubmit}>
      <h2>Who's browsing?</h2>
      <p className="hint">Pick a user to see their personalised feed.</p>

      {users.length === 0 ? (
        <p className="status">No users found. Run npm run seed in the server folder.</p>
      ) : (
        <div className="picker-options">
          {users.map((user) => (
            // Each option is a radio input inside a label, so clicking anywhere on the row selects it
            <label key={user._id} className={`picker-option ${choice === user._id ? "selected" : ""}`}>
              <input type="radio" name="user" value={user._id} checked={choice === user._id} onChange={() => setChoice(user._id)} />
              <span className="avatar">{initials(user.name)}</span>
              <span>{user.name}</span>
            </label>
          ))}
        </div>
      )}

      <button type="submit" className="primary" disabled={!choice}>
        Continue
      </button>
    </form>
  );
}
