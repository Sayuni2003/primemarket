import { capitalise, formatAttribute, formatPrice, getKeyAttributes } from "../format.js";
import ListingImage from "./ListingImage.jsx";
import SaveButton from "./SaveButton.jsx";

// score and reasons are only passed for recommended listings
export default function ListingCard({ listing, score, reasons, save, onSave, onOpen }) {
  return (
    <article className="card" onClick={onOpen}>
      <ListingImage src={listing.imageUrl} alt={listing.title} />
      <div className="card-body">
        <p className="meta">
          {capitalise(listing.category)} · {listing.location}
        </p>
        <h3>{listing.title}</h3>
        <p className="price">{formatPrice(listing.price)}</p>

        <ul className="chips">
          {getKeyAttributes(listing).map((attribute) => {
            const { label, value } = formatAttribute(attribute);
            return (
              <li key={attribute.key}>
                {label}: {value}
              </li>
            );
          })}
        </ul>

        {reasons?.length > 0 && (
          <div className="reasons">
            <p className="score">Score {score}</p>
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        <SaveButton save={save} onSave={onSave} />
      </div>
    </article>
  );
}
