import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Container({ children, className = "" }: Props) {
  return (
    <div
      className={`mx-auto w-full max-w-7xl 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
