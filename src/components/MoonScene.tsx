import React, { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import MissionChecklist from "./MissionChecklist";
import { Howl } from "howler";

// Set the default ellipsoid to Moon
Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;

// Define Points of Interest and Camera Views outside the component
const pointsOfInterest = [
  { text: "Apollo 11", latitude: 0.67416, longitude: 23.47315 },
  { text: "Apollo 14", latitude: -3.64417, longitude: 342.52135 },
  { text: "Apollo 15", latitude: 26.13341, longitude: 3.6285 },
];

// Define lunar descent checklist items
const lunarDescentChecklist = [
  {
    id: "item9",
    text: "Verify AGC Lunar Descent program loaded",
    checked: false,
    required: true,
  },
];

// Initialize audio for lunar descent
const descentRadio = new Howl({
  src: ["/audio/a11_landing.mp3"],
  volume: 0.7,
  preload: true,
  html5: true,
});

const MoonScene: React.FC = () => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioPlayingRef = useRef<boolean>(false);
  // Add a new ref to track if descent has been initiated
  const descentInitiatedRef = useRef<boolean>(false);

  // State for checklist and simulation flow
  const [showChecklist, setShowChecklist] = useState(true);
  const [agcConnected, setAgcConnected] = useState(false);
  const [agcProgramType, setAgcProgramType] = useState<string | null>(null);
  const [simulationActive, setSimulationActive] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const lastProgramTypeRef = useRef<string | null>(null);
  const [missionPhase, setMissionPhase] = useState<string>("PRE-DESCENT");

  // Connect  WebSocket for AGC data
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connection established in MoonScene");
      websocketRef.current = ws;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "agc-status") {
          console.log("AGC status update in MoonScene:", message);
          setAgcConnected(message.connected);
          setAgcProgramType(message.programType);

          // Auto-proceed when moon_landing program is first detected
          if (
            message.programType === "moon_landing" &&
            lastProgramTypeRef.current !== "moon_landing" &&
            !simulationActive &&
            showChecklist
          ) {
            console.log("Moon landing program detected - auto proceeding!");
            handleChecklistComplete();
          }

          // Only control clock animation if descent has not been initiated yet
          if (
            viewerRef.current &&
            !viewerRef.current.isDestroyed() &&
            !descentInitiatedRef.current
          ) {
            viewerRef.current.clock.shouldAnimate =
              message.connected && message.programType === "moon_landing";
          }
          // If descent has been initiated, ensure animation continues regardless of AGC status
          else if (
            viewerRef.current &&
            !viewerRef.current.isDestroyed() &&
            descentInitiatedRef.current
          ) {
            viewerRef.current.clock.shouldAnimate = true;
          }

          lastProgramTypeRef.current = message.programType;
        }

        if (message.type === "agc-output") {
          console.log("Received AGC output in MoonScene:", message.payload);
          // We could also check here for program type based on specific register patterns
          // if server detection isn't working as expected
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error in MoonScene:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed in MoonScene");
      websocketRef.current = null;
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [simulationActive, showChecklist]); // Add dependencies

  // Start the Cesium viewer when the component mounts
  useEffect(() => {
    if (cesiumContainerRef.current && !viewerRef.current) {
      const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
        baseLayer: false, // No base imagery layer
        timeline: false,
        animation: true,
        baseLayerPicker: false,
        geocoder: false,
        shadows: true,
        homeButton: false,
        infoBox: true,
        sceneModePicker: false,
        navigationHelpButton: false,
      });
      viewerRef.current = viewer;
      const scene = viewer.scene;

      const startTime = Cesium.JulianDate.fromIso8601("1969-07-20T20:05:00Z");
      viewer.clock.currentTime = startTime;
      viewer.clock.startTime = startTime;
      viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
      // Initially pause the clock until AGC program is detected
      viewer.clock.shouldAnimate = false;

      scene.skyBox = Cesium.SkyBox.createEarthSkyBox();

      // Add Moon Terrain 3D Tiles
      Cesium.Cesium3DTileset.fromIonAssetId(2684829, {
        enableCollision: true,
      })
        .then((tileset) => {
          scene.primitives.add(tileset);
        })
        .catch((error) => {
          console.log(`Error loading tileset: ${error}`);
        });

      // Add Points of Interest
      pointsOfInterest.forEach((poi) => {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(poi.longitude, poi.latitude),
          label: {
            text: poi.text,
            font: "14pt Verdana",
            outlineColor: Cesium.Color.DARKSLATEGREY,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -22),
            scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5),
            translucencyByDistance: new Cesium.NearFarScalar(
              2.5e7,
              1.0,
              4.0e7,
              0.0
            ),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromBytes(243, 242, 99),
            outlineColor: Cesium.Color.fromBytes(219, 218, 111),
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1.5e3, 1.0, 4.0e7, 0.1),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });

      async function initialize() {
        const czmlFilePath = "/apollo11_mission.czml";
        try {
          // Set up clock settings before loading CZML
          const startTime = Cesium.JulianDate.fromIso8601(
            "1969-07-20T19:51:30Z"
          );
          const stopTime = Cesium.JulianDate.fromIso8601(
            "1969-07-21T21:00:00Z"
          );

          // Create data source with custom clock settings
          const czmlDataSource = new Cesium.CzmlDataSource({
            // Override the default CZML clock settings
            clock: new Cesium.DataSourceClock({
              startTime: startTime,
              currentTime: startTime,
              stopTime: stopTime,
              clockRange: Cesium.ClockRange.LOOP_STOP,
              multiplier: 1,
            }),
          });

          // Load CZML data
          await czmlDataSource.load(czmlFilePath);
          await viewer.dataSources.add(czmlDataSource);

          // Force viewer clock settings after CZML is loaded
          viewer.clock.startTime = startTime;
          viewer.clock.currentTime = startTime;
          viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
          viewer.clock.multiplier = 1;

          viewer.clock.shouldAnimate = false;

          // Setup proper orientation for both stages
          const descentStage = czmlDataSource.entities.getById("LM_Descent");
          const ascentStage = czmlDataSource.entities.getById("LM_Ascent");

          if (descentStage && descentStage.position) {
            descentStage.orientation = new Cesium.VelocityOrientationProperty(
              descentStage.position
            );
            descentStage.viewFrom = new Cesium.ConstantProperty(
              new Cesium.Cartesian3(0, 50, 10) // Further view for descent stage
            );

            viewer.trackedEntity = descentStage;
          }

          if (ascentStage && ascentStage.position) {
            ascentStage.orientation = new Cesium.VelocityOrientationProperty(
              ascentStage.position
            );
            ascentStage.viewFrom = new Cesium.ConstantProperty(
              new Cesium.Cartesian3(-100, 20, 50)
            );
          } else {
            console.error(
              "Descent stage position is undefined at the current time."
            );
          }
        } catch (error) {
          console.error(
            `Failed to load the CZML file from '${czmlFilePath}'.`,
            error
          );
        }
      }

      initialize();

      // Cleanup function
      return () => {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
        }
        viewerRef.current = null;
      };
    }
  }, []); // Initialize immediately when component mounts

  const handleChecklistComplete = () => {
    setChecklistCompleted(true);
    setShowChecklist(false);
    setSimulationActive(true);
    setMissionPhase("LUNAR DESCENT INITIATED");

    // Set our descent initiated flag to true
    descentInitiatedRef.current = true;

    // Play the descent radio audio
    if (!audioPlayingRef.current) {
      descentRadio.play();
      audioPlayingRef.current = true;
    }

    // Ensure the clock starts when checklist is complete
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      viewerRef.current.clock.shouldAnimate = true;
    }
  };

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioPlayingRef.current) {
        descentRadio.stop();
        audioPlayingRef.current = false;
      }
    };
  }, []);

  // Determine if we can proceed based on AGC program type
  const canProceedWithMission =
    agcConnected && agcProgramType === "moon_landing";

  return (
    <div className="relative w-full h-screen">
      <div ref={cesiumContainerRef} className="w-full h-full" />

      {showChecklist && (
        <MissionChecklist
          title="LUNAR DESCENT CHECKLIST"
          items={lunarDescentChecklist}
          onComplete={handleChecklistComplete}
          canProceed={canProceedWithMission}
          missionType="landing"
          waitingForAGC={true}
        />
      )}

      {/* Mission status toggle button */}
      {!showChecklist && checklistCompleted && (
        <div className="absolute top-4 left-4 z-10">
          <button className="bg-zinc-950 border border-zinc-800 rounded-md p-3 text-zinc-300 font-mono text-xs hover:bg-zinc-900 transition-colors">
            <div className="mb-1 text-zinc-500">{missionPhase}</div>
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${simulationActive ? "bg-zinc-500 animate-pulse" : "bg-zinc-700"}`}
              ></div>
              {simulationActive
                ? "DESCENT IN PROGRESS"
                : "WAITING FOR AGC PROGRAM"}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default MoonScene;
