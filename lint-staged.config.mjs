export default {
  "client/**/*.{js,jsx,ts,tsx}": (filenames) => {
    const quotedFilenames = filenames.map((filename) => `"${filename.replaceAll('"', '\\"')}"`);
    return `npm run lint --prefix client -- --fix ${quotedFilenames.join(" ")}`;
  },
  "src/**/*.{ts,js}": () => "npm run build",
};
