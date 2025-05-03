import Image from "next/image";

export default function Logo({ size = 48 }) {
  return (
    <Image src="/logo.png" alt="Logo" width={size} height={size} priority />
  );
}