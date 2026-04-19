import { useState } from 'react';
import type { Member } from '../types';
import { partyColor } from '../utils/format';

interface MemberCardProps {
  member: Member;
  onClick: () => void;
}

export function MemberCard({ member, onClick }: MemberCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);

  const label = `View profile for ${member.fullName}, ${member.party}${member.constituency ? `, ${member.constituency}` : ''}`;
  return (
    <button className="member-card" onClick={onClick} aria-label={label}>
      <div className="member-card__photo-wrap">
        {!photoFailed ? (
          <img
            src={member.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="member-card__photo"
            onError={() => { setPhotoFailed(true); }}
          />
        ) : (
          <div className="member-card__initials" aria-hidden="true">
            {member.firstName[0]}{member.lastName[0]}
          </div>
        )}
      </div>
      <div className="member-card__name">{member.fullName}</div>
      <span
        className="party-badge"
        style={{ backgroundColor: partyColor(member.party) }}
      >
        {member.party}
      </span>
      {member.constituency && (
        <div className="member-card__constituency">{member.constituency}</div>
      )}
      {member.offices.length > 0 && (
        <div className="member-card__office">{member.offices.at(0)}</div>
      )}
    </button>
  );
}
