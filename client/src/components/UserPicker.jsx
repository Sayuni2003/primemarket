// One button per seeded user. There's no password: the app has no auth, it just remembers who you picked
export default function UserPicker({ users, onSelect }) {
  return (
    <section className="picker">
      <h2>Who's browsing?</h2>
      {users.length === 0 ? (
        <p className="status">No users found. Run npm run seed in the server folder.</p>
      ) : (
        <div className="picker-buttons">
          {users.map((user) => (
            <button key={user._id} onClick={() => onSelect(user._id)}>
              {user.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
