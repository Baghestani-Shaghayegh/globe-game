import { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import Globe from "react-globe.gl";
import * as THREE from "three";
import CountryGuessModal from "./modals/CountryGuessModal";
import { recognizedCountries } from '../data/recognizedCountries';

const GlobeView = () => {

  const COLORS = [
  "#e6194b", // red
  "#3cb44b", // green
  "#ffe119", // yellow
  "#4363d8", // blue
  "#f58231", // orange
  "#911eb4", // purple
  "#46f0f0", // cyan
  "#f032e6", // magenta
  "#bcf60c", // lime
  "#fabebe", // pink
  "#008080", // teal
  "#e6beff", // lavender
  "#9a6324", // brown
  "#fffac8", // light yellow
  "#800000", // maroon
  "#aaffc3", // mint
  "#808000", // olive
  "#ffd8b1", // apricot
  "#000075", // navy
  "#808080", // grey
];

const countriesWithColors = recognizedCountries.map((name, index) => ({
  name,
  color: COLORS[index % COLORS.length],
}));


  const countryColorMap = new Map(countriesWithColors.map((c) => [c.name, c.color]));

  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState({ features: [] });

  // State for modal
  const [selectedCountry, setSelectedCountry] = useState<any | null>(null);
  const [guess, setGuess] = useState<string>("");
  const [isWrong, setIsWrong] = useState(false);
  const [correctCountryNames, setCorrectCountryNames] = useState<string[]>([]);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then((res) => res.json())
  .then((data) => {
      const recognizedSet = new Set(recognizedCountries);

      const filtered = {
        ...data,
        features: data.features.filter((feature: { properties: { name: string } }) =>
          recognizedSet.has(feature.properties.name)
        ),
      };

      setCountries(filtered);
    });
  }, []);

  const handleSubmitGuess = (overrideGuess?: string) => {
    if (!selectedCountry) return;

    const actualName = selectedCountry.properties.name;
    const answerToCheck = overrideGuess !== undefined ? overrideGuess : guess;

    if (answerToCheck.trim().toLowerCase() === actualName.trim().toLowerCase()) {
      // Add country if not already in the list
      setCorrectCountryNames((prev) => {
        if (!prev.includes(actualName)) {
          return [...prev, actualName];
        }
        return prev;
      });
      setSelectedCountry(null);
      setGuess("");
    } else {
      // Show error animation
      alert(actualName)
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 2000);
    }
  };

  const handleClose = (): void => {
    setSelectedCountry(null);
    setGuess("");
  };

  return (
    <>
      <Globe
        ref={globeEl}
        rendererConfig={{ antialias: true, alpha: true }}
        backgroundColor="white"
        globeMaterial={
          new THREE.MeshPhongMaterial({
            color: "#87CEEB",
            shininess: 0,
          })
        }
        polygonsData={countries.features}
        polygonCapColor={(d: any) =>
          correctCountryNames.includes(d.properties.name)
            ? countryColorMap.get(d.properties.name) || "white"
            : "white"
        }
        polygonStrokeColor={() => "black"}
        polygonAltitude={() => 0.002}
        polygonsTransitionDuration={0}
        onPolygonClick={(polygon) => setSelectedCountry(polygon)}
      />

      <CountryGuessModal
        selectedCountry={selectedCountry}
        guess={guess}
        setGuess={setGuess}
        onClose={handleClose}
        onSubmit={handleSubmitGuess}
        isWrong={isWrong}
      />
    </>
  );
};

export default GlobeView;
