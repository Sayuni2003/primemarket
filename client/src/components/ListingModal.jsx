import { useState } from "react";
import { recordInteraction } from "../api.js";
import { capitalise, formatAttribute, formatPrice } from "../format.js";
import ListingImage from "./ListingImage.jsx";
import SaveButton from "./SaveButton.jsx";

// All details of one listing. The "view" was already recorded by Feed when the card was clicked
export default function ListingModal({ listing, userId, viewError, save, onSave, onClose }) {
  // "idle" → "contacting" → "contacted" (seller shown), or "error"
  const [contact, setContact] = useState({ status: "idle", error: "" });

  const contactSeller = async () => {
    setContact({ status: "contacting", error: "" });
    try {
      await recordInteraction(userId, listing._id, "contact_seller");
      setContact({ status: "contacted", error: "" });
    } catch (err) {
      setContact({ status: "error", error: err.message });
    }
  };

  return (
    // Clicking the dark backdrop closes the modal; clicks inside the modal are stopped from reaching it
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={listing.title} onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <ListingImage src={listing.imageUrl} alt={listing.title} />

        <div className="modal-body">
          <p className="meta">
            {capitalise(listing.category)} · {listing.location}
          </p>
          <h2>{listing.title}</h2>
          <p className="price">{formatPrice(listing.price)}</p>
          {viewError && <p className="error">Couldn't record this view: {viewError}</p>}

          <dl className="details">
            {listing.attributes.map((attribute) => {
              const { label, value } = formatAttribute(attribute);
              return (
                <div key={attribute.key}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
          <p className="hint">Listed on {new Date(listing.createdAt).toLocaleDateString("en-LK")}</p>

          <div className="actions">
            <SaveButton save={save} onSave={onSave} />
            {contact.status !== "contacted" && (
              <button className="primary" onClick={contactSeller} disabled={contact.status === "contacting"}>
                {contact.status === "contacting" ? "Contacting…" : "Contact Seller"}
              </button>
            )}
          </div>
          {contact.status === "error" && <p className="error">{contact.error}</p>}

          {contact.status === "contacted" && (
            <div className="seller">
              <p>
                Seller: <strong>{listing.seller.name}</strong>
              </p>
              <p>
                Phone: <strong>{listing.seller.phoneNo}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
