## Packages
leaflet | Core mapping library
react-leaflet | React bindings for Leaflet
@types/leaflet | Types for Leaflet
framer-motion | For smooth drawer and dialog animations
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind classes safely

## Notes
- Using OpenStreetMap tiles for the map.
- Leaflet CSS must be imported in index.css or App.tsx.
- Fix for Leaflet default icon issues required in global setup.
- Authentication uses the provided `useAuth` hook and `api/login` endpoints.
