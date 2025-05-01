import { useState, lazy, Suspense, useEffect } from "react";
import HomeScreen from "./components/HomeScreen";
import Earth from "./components/EarthScene";
import LoadingScreen from "./components/LoadingScreen";
import AgcConnectionIndicator from "./components/AgcConnectionIndicator";
const MoonScene = lazy(() => import("./components/MoonScene"));

function App() {
  window.CESIUM_BASE_URL = "/cesium/"; // Example path, adjust as needed
  const [currentScene, setCurrentScene] = useState("home"); // Start with home screen
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [nextScene, setNextScene] = useState(null); // Track the next scene to load
  const [agcConnected, setAgcConnected] = useState(false); // Track AGC connection status

  // Callback function to switch scenes
  const handleEarthSceneEnd = () => {
    console.log("Earth scene finished, returning to home screen");
    setIsLoading(true);
    setNextScene("home");
  };

  // Handle scene selection from home screen
  const handleSceneSelect = (scene) => {
    console.log(`Selected scene: ${scene}`);
    setIsLoading(true); // Start loading
    setNextScene(scene); // Set the next scene to load
  };

  // Effect to transition from loading to the actual scene
  useEffect(() => {
    if (isLoading && nextScene) {
      const timer = setTimeout(() => {
        setCurrentScene(nextScene);
        setIsLoading(false);
        setNextScene(null);
      }, 1000); // Reduced timeout

      return () => clearTimeout(timer);
    }
  }, [isLoading, nextScene]);

  // Set up WebSocket connection to monitor AGC status
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle specific AGC status messages
        if (data.type === "agc-status") {
          setAgcConnected(data.connected);
          console.log(
            "AGC connection status:",
            data.connected ? "connected" : "disconnected"
          );
        }
        // Continue handling other message types if needed
        else if (data.type === "agc-output") {
          // Process AGC output data if needed
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setAgcConnected(false);
    };

    socket.onerror = () => {
      console.error("WebSocket error");
      setAgcConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <>
      <AgcConnectionIndicator connected={agcConnected} />
      <div>
        {/* Render Home Screen */}
        {currentScene === "home" && !isLoading && (
          <HomeScreen onSceneSelect={handleSceneSelect} />
        )}

        {/* Render Loading Screen */}
        {isLoading && (
          <LoadingScreen
            message={
              nextScene === "earth"
                ? "Preparing Earth launch sequence..."
                : "Initiating lunar landing module..."
            }
          />
        )}

        {/* Render Earth scene */}
        {currentScene === "earth" && !isLoading && (
          <Suspense
            fallback={
              <LoadingScreen message="Preparing Earth launch sequence..." />
            }
          >
            <Earth onEarthSceneEnd={handleEarthSceneEnd} />
          </Suspense>
        )}

        {/* Render Moon scene with Suspense */}
        {currentScene === "moon" && !isLoading && (
          <Suspense
            fallback={
              <LoadingScreen message="Initiating lunar landing module..." />
            }
          >
            <MoonScene />
          </Suspense>
        )}
      </div>
    </>
  );
}

export default App;
