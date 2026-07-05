'use client';

interface OnlineUser {
  id: string;
  username: string;
  color: string;
  cursor: { x: number; y: number };
}

export default function CursorOverlay({ users }: { users: OnlineUser[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {users.map((user) => (
        <div
          key={user.id}
          className="absolute"
          style={{
            left: user.cursor.x,
            top: user.cursor.y,
            transition: 'left 100ms linear, top 100ms linear',
            transform: 'translate(-2px, -2px)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M0 0L0 10L3.5 7H7L0 0Z"
              fill={user.color}
              stroke="white"
              strokeWidth="0.5"
            />
          </svg>
          <div
            className="mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-white whitespace-nowrap"
            style={{ backgroundColor: user.color }}
          >
            {user.username}
          </div>
        </div>
      ))}
    </div>
  );
}
