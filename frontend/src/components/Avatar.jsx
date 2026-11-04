import { useState } from 'react';
import { initials } from '../utils/formatters';

/**
 * The person's profile photo, or their initials when there is none (or the photo link has expired).
 * size: sm (32px) | md (40px) | lg (112px). Decorative by default, because the name is always shown next to it.
 */
export default function Avatar({ user, size = 'md', className = '', alt = '' }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = user?.avatar_url;
  const showPhoto = Boolean(url) && failedUrl !== url;
  const classes = ['vmt-avatar', size !== 'md' && `vmt-avatar-${size}`, showPhoto && 'has-photo', className].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-hidden={alt ? undefined : 'true'}>
      {showPhoto ? (
        <img src={url} alt={alt} onError={() => setFailedUrl(url)} draggable="false" />
      ) : (
        initials(user?.full_name || '')
      )}
    </span>
  );
}
