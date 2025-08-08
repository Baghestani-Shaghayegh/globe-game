import { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import Globe from "react-globe.gl";
import * as THREE from "three";
import CountryGuessModal from "./modals/CountryGuessModal";
import countriesList from "../data/countriesList";

const GlobeView = () => {
  const countryColorMap = new Map(countriesList.map((c) => [c.name, c.color]));

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
      .then((data) => setCountries(data));
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
            color: "white",
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
