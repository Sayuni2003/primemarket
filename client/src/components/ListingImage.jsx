import { useState } from "react";

// The listing photo, or a placeholder when there's no imageUrl or the image fails to load
// (e.g. its presigned S3 URL expired after 5 minutes), so there's never a broken image icon
export default function ListingImage({ src, alt }) {
  // Remember which URL failed: after "Refresh feed" the listing gets a new URL, which is tried again
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || src === failedSrc) {
    return <div className="image placeholder">No photo</div>;
  }
  return <img className="image" src={src} alt={alt} onError={() => setFailedSrc(src)} />;
}
