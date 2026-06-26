export default function LogoOverlay() {
  return (
    <svg
      className="siteLogoOverlaySvg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="site-logo-fill-clip">
          <path
            d="M6 24L13.2 19.2L17.28 24H24V0H22.8V22.8H18L6 7.2V24Z"
          />
          <path
            d="M18 0L10.8 4.8L6.72 0H0V24H1.2V1.2H6L18 16.8V0Z"
          />
        </clipPath>
      </defs>

      <path
        className="siteLogoOverlayShape"
        d="M6 24L13.2 19.2L17.28 24H24V0H22.8V22.8H18L6 7.2V24Z"
      />
      <path
        className="siteLogoOverlayShape"
        d="M18 0L10.8 4.8L6.72 0H0V24H1.2V1.2H6L18 16.8V0Z"
      />

      <g clipPath="url(#site-logo-fill-clip)">
        <rect
          className="siteLogoOverlayShineLine"
          x="11.88"
          y="-16"
          width="0.24"
          height="56"
          rx="0.12"
        />
      </g>
    </svg>
  );
}
