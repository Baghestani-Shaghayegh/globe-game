import React, { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import Globe from "react-globe.gl";
import * as THREE from "three";

const GlobeView = () => {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState({ features: [] });

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then((res) => res.json())
      .then((data) => setCountries(data));
  }, []);
  return (
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
    />
  );
};

export default GlobeView;
