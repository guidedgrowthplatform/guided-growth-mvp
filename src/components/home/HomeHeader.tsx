import { format } from 'date-fns';

interface HomeHeaderProps {
  userName: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function HomeHeader({ userName }: HomeHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-normal text-content">
        {format(new Date(), 'EEEE, MMMM d, yyyy')}
      </span>
      <h1 className="text-[28px] font-semibold leading-tight text-content">
        {getGreeting()}, {userName}
      </h1>
    </div>
  );
}
