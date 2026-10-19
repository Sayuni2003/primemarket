import { capitalise, formatAttribute, formatPrice, getKeyAttributes } from "../format.js";
import ListingImage from "./ListingImage.jsx";
import SaveButton from "./SaveButton.jsx";

export default function ListingCard({ listing, save, onSave, onOpen }) {
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

        <SaveButton save={save} onSave={onSave} />
      </div>
    </article>
  );
}
