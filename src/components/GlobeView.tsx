import { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import Globe from "react-globe.gl";
import * as THREE from "three";
import CountryGuessModal from "./modals/CountryGuessModal";

const GlobeView = () => {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState({ features: [] });

  // State for modal
  const [selectedCountry, setSelectedCountry] = useState<any | null>(null);
  const [guess, setGuess] = useState<string>("");

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then((res) => res.json())
      .then((data) => setCountries(data));
  }, []);

  const handleSubmitGuess = () => {
    if (!selectedCountry) return;

    const actualName = selectedCountry.properties.name;
    console.log(actualName, "naem");
    if (guess.trim().toLowerCase() === actualName.trim().toLowerCase()) {
      alert("Correct!");
    } else {
      alert(`Wrong! It's ${actualName}`);
    }
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
        polygonCapColor={() => "white"}
        polygonStrokeColor={() => "black"}
        polygonAltitude={() => 0.002}
        polygonsTransitionDuration={0}
        onPolygonClick={(polygon) => setSelectedCountry(polygon)}
      />

      <CountryGuessModal
        selectedCountry={selectedCountry}
        guess={guess}
        setGuess={setGuess}
        onClose={() => setSelectedCountry(null)}
        onSubmit={handleSubmitGuess}
      />
    </>
  );
};

export default GlobeView;
