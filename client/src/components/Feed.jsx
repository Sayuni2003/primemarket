import { useEffect, useState } from "react";
import { getRecommendations, recordInteraction } from "../api.js";
import ListingCard from "./ListingCard.jsx";
import ListingModal from "./ListingModal.jsx";

// The personalised feed for one user. It is fetched on load and on "Refresh feed" only, never after
// a click, so cards don't jump around while the user is browsing
export default function Feed({ userId }) {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // the listing open in the modal
  const [viewError, setViewError] = useState("");
  // listingId → { status: "saving" | "saved" | "error", error }. Kept here because the card and the
  // modal both show a Save button for the same listing
  const [saves, setSaves] = useState({});

  const loadFeed = async () => {
    setLoading(true);
    setError("");
    try {
      setFeed(await getRecommendations(userId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [userId]);

  // Opening a listing records a "view". Done in the click handler so it happens once per open
  const openListing = (listing) => {
    setSelected(listing);
    setViewError("");
    recordInteraction(userId, listing._id, "view").catch((err) => setViewError(err.message));
  };

  const saveListing = async (listingId) => {
    setSaves((prev) => ({ ...prev, [listingId]: { status: "saving" } }));
    try {
      await recordInteraction(userId, listingId, "save");
      setSaves((prev) => ({ ...prev, [listingId]: { status: "saved" } }));
    } catch (err) {
      setSaves((prev) => ({ ...prev, [listingId]: { status: "error", error: err.message } }));
    }
  };

  // First load: nothing to show yet except the spinner text or the error
  if (!feed) {
    return loading ? (
      <p className="status">Loading your feed…</p>
    ) : (
      <p className="error">
        {error} <button onClick={loadFeed}>Try again</button>
      </p>
    );
  }

  const { isNewUser, message, recommendations, others } = feed;

  // recommendations items are { listing, score, reasons }, others are { listing }. Only the listing is shown
  const renderCards = (items) => (
    <div className="grid">
      {items.map(({ listing }) => (
        <ListingCard
          key={listing._id}
          listing={listing}
          save={saves[listing._id]}
          onSave={() => saveListing(listing._id)}
          onOpen={() => openListing(listing)}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="toolbar">
        <button onClick={loadFeed} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh feed"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {isNewUser ? (
        <section>
          <h2>Fresh picks for you</h2>
          <p className="hint">{message}</p>
          {renderCards(others)}
        </section>
      ) : (
        <>
          {recommendations.length > 0 && (
            <section>
              <h2>Recommended for you</h2>
              <p className="hint">Based on the listings you viewed, saved and contacted sellers about.</p>
              {renderCards(recommendations)}
            </section>
          )}
          <section>
            <h2>{recommendations.length > 0 ? "More listings" : "Latest listings"}</h2>
            {message && <p className="hint">{message}</p>}
            {renderCards(others)}
          </section>
        </>
      )}

      {selected && (
        <ListingModal
          listing={selected}
          userId={userId}
          viewError={viewError}
          save={saves[selected._id]}
          onSave={() => saveListing(selected._id)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
