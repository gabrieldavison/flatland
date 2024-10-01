import "./style.css";
import Alpine from "alpinejs";

///////////////////// Seutp Alpinejs

(window as any).Alpine = Alpine;

Alpine.start();

///////////////////////////// Types and Interfaces /////////////////////////////

interface Point {
  x: number;
  y: number;
}

interface Square {
  size: number;
  verticalOffset: number;
}

interface AppState {
  square: Square;
  path: Point[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  horizontalPosition: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  frameCount: number;
  speed: number;
  isStarted: boolean;
}

interface CommandLoop {
  id: number | null;
  commands: string[];
  stopRequest: boolean;
}

///////////////////////////// State Management /////////////////////////////

const createInitialState = (): AppState => {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  return {
    square: { size: 20, verticalOffset: 0 },
    path: [{ x: 0, y: 0 }],
    canvas,
    ctx,
    horizontalPosition: 0,
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    frameCount: 0,
    speed: 1,
    isStarted: false,
  };
};

let state = createInitialState();
let evalHistory: string[] = [];
let commandLoops: CommandLoop[] = [];
let replHistory: string[] = [];

///////////////////////////// Square Movement and Path Drawing /////////////////////////////

const updateSquarePosition = (
  state: AppState,
  dx: number,
  dy: number
): AppState => {
  const newHorizontalPosition = state.horizontalPosition + dx * state.speed;
  const newVerticalOffset = state.square.verticalOffset + dy * state.speed;
  const newPath = [
    ...state.path,
    { x: newHorizontalPosition, y: newVerticalOffset },
  ];
  return {
    ...state,
    square: { ...state.square, verticalOffset: newVerticalOffset },
    path: newPath,
    horizontalPosition: newHorizontalPosition,
    minX: Math.min(state.minX, newHorizontalPosition),
    maxX: Math.max(state.maxX, newHorizontalPosition),
    minY: Math.min(state.minY, newVerticalOffset),
    maxY: Math.max(state.maxY, newVerticalOffset),
    frameCount: state.frameCount + 1,
  };
};

const drawPath = (
  ctx: CanvasRenderingContext2D,
  path: Point[],
  horizontalPosition: number,
  verticalOffset: number,
  canvasWidth: number,
  canvasHeight: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) => {
  ctx.strokeStyle = "#090A02";
  ctx.beginPath();

  const pathWidth = maxX - minX;
  const pathHeight = maxY - minY;
  const scale =
    Math.min(canvasWidth / pathWidth, canvasHeight / pathHeight) * 0.8; // 0.8 to leave some margin

  const offsetX = (canvasWidth - pathWidth * scale) / 2 - minX * scale;
  const offsetY = (canvasHeight - pathHeight * scale) / 2 - minY * scale;

  path.forEach((point, index) => {
    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Draw the square at its current position
  const squareX = horizontalPosition * scale + offsetX;
  const squareY = verticalOffset * scale + offsetY;
  ctx.fillStyle = "#E03C17";
  ctx.fillRect(squareX - 5, squareY - 5, 10, 10);
};

///////////////////////////// Rendering and Animation /////////////////////////////

const render = (state: AppState) => {
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  drawPath(
    state.ctx,
    state.path,
    state.horizontalPosition,
    state.square.verticalOffset,
    state.canvas.width,
    state.canvas.height,
    state.minX,
    state.maxX,
    state.minY,
    state.maxY
  );
};

const animate = () => {
  if (state.isStarted) {
    state = {
      ...state,
      horizontalPosition: state.horizontalPosition + 1 * state.speed,
      maxX: Math.max(state.maxX, state.horizontalPosition + 1 * state.speed),
      path: [
        ...state.path,
        {
          x: state.horizontalPosition + 1 * state.speed,
          y: state.square.verticalOffset,
        },
      ],
      frameCount: state.frameCount + 1,
    };
    render(state);
  }
  render(state);
  updateUi(commandLoops);
  requestAnimationFrame(animate);
};

///////////////////////////// UI Management /////////////////////////////

const commandHistoryRoot = document.getElementById(
  "command-history"
) as HTMLElement;

const replHistoryRoot = document.getElementById("repl-history") as HTMLElement;

const updateUi = (commandLoops: CommandLoop[]) => {
  const loopHtml = commandLoops.map((loop, i) => Loop(loop, i)).join("");
  commandHistoryRoot.innerHTML = loopHtml;

  const replHistoryHtml = replHistory.map((item) => HistoryItem(item)).join("");
  replHistoryRoot.innerHTML = replHistoryHtml;
};

const Loop = (loop: CommandLoop, index: number) =>
  `<div>${index}:  ${loop.commands.join(" | ")}</div>`;

const HistoryItem = (item: string) => `<div>${item}</div>`;

///////////////////////////// Command Execution /////////////////////////////

const smartExecuteCommands = async (input: string) => {
  const commands = input.split(" ");

  if (commands.length === 1) {
    // Single command execution
    await executeSingleCommand(commands[0]);
  } else {
    // Check for special commands first
    if (commands[0].startsWith("stop") || commands[0].startsWith("speed")) {
      await executeSingleCommand(commands[0]);
    } else {
      // Multiple commands execution (create a loop)
      await r(input);
    }
  }
};

const executeSingleCommand = async (command: string) => {
  if (!state.isStarted) {
    state = { ...state, isStarted: true };
  }
  if (command.startsWith("stop")) {
    const index = parseInt(command.slice(4));
    stop(isNaN(index) ? undefined : index);
  } else if (command.startsWith("speed")) {
    const value = parseInt(command.slice(5));
    if (!isNaN(value)) {
      speed(value);
    } else {
      console.error("Speed command requires a numeric value");
    }
  } else if (command === "dlImg") {
    dl();
  } else if (command === "dlSvg") {
    exportSvg();
  } else {
    const [action, value] = parseCommand(command);
    if (action === "wait") {
      await wait(value);
    } else {
      await moveSquare(action as "up" | "down" | "back" | "forward", value);
    }
  }
};

const parseCommand = (cmd: string): [string, number] => {
  const direction = cmd.charAt(0);
  const value = parseInt(cmd.slice(1));
  switch (direction) {
    case "u":
      return ["up", value];
    case "d":
      return ["down", value];
    case "b":
      return ["back", value];
    case "f":
      return ["forward", value];
    case "w":
      return ["wait", value];
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
};

const executeCommands = async (commands: string[]) => {
  for (const cmd of commands) {
    const [action, value] = parseCommand(cmd);
    if (action === "wait") {
      await wait(value);
    } else {
      await moveSquare(action as "up" | "down" | "back" | "forward", value);
    }
  }
};

///////////////////////////// Movement and Wait Commands /////////////////////////////

const wait = (frames: number) =>
  new Promise<void>((resolve) => {
    const adjustedFrames = frames / state.speed;
    const targetFrame = state.frameCount + adjustedFrames;
    const checkFrame = () => {
      if (state.frameCount >= targetFrame) {
        resolve();
      } else {
        requestAnimationFrame(checkFrame);
      }
    };
    checkFrame();
  });

const moveSquare = (
  direction: "up" | "down" | "back" | "forward",
  distance: number
): Promise<void> => {
  return new Promise<void>((resolve) => {
    let dx = 0;
    let dy = 0;

    switch (direction) {
      case "up":
        dy = -distance;
        break;
      case "down":
        dy = distance;
        break;
      case "back":
        dx = -distance;
        break;
      case "forward":
        dx = distance;
        break;
    }

    state = updateSquarePosition(state, dx, dy);
    render(state);
    resolve();
  });
};

const up = (distance: number): Promise<void> => moveSquare("up", distance);
const down = (distance: number): Promise<void> => moveSquare("down", distance);
const back = (distance: number): Promise<void> => moveSquare("back", distance);
const forward = (distance: number): Promise<void> =>
  moveSquare("forward", distance);

///////////////////////////// Loop and Control Commands /////////////////////////////

const r = async (commandString: string) => {
  if (!state.isStarted) {
    state = { ...state, isStarted: true };
  }
  const commands = commandString.split(" ");

  const commandLoop: CommandLoop = {
    id: null,
    commands: commands,
    stopRequest: false, // Initialize stopRequest
  };

  const loop = async () => {
    if (commandLoop.stopRequest) {
      commandLoop.id = null;
      return;
    }
    await executeCommands(commandLoop.commands);
    commandLoop.id = requestAnimationFrame(loop);
  };

  // Start a new animation
  commandLoop.id = requestAnimationFrame(loop);

  commandLoops.push(commandLoop);
  return commandLoops.length - 1;
};

const stop = (index?: number) => {
  if (index !== undefined && index >= 0 && index < commandLoops.length) {
    // Stop a specific animation
    const commandLoop = commandLoops[index];
    if (commandLoop.id !== null) {
      commandLoop.stopRequest = true; // Set stopRequest flag
      cancelAnimationFrame(commandLoop.id);
      commandLoops = commandLoops.filter((val) => val.id !== commandLoop.id);
      console.log(`Animation ${index} stopped`);
    } else {
      console.log(`Animation ${index} is already stopped`);
    }
  } else if (index === undefined) {
    // Stop all animations
    commandLoops.forEach((commandLoop, i) => {
      if (commandLoop.id !== null) {
        commandLoop.stopRequest = true; // Set stopRequest flag
        cancelAnimationFrame(commandLoop.id);
        commandLoop.id = null;
        console.log(`Animation ${i} stopped`);
      }
    });
    commandLoops = [];
    console.log("All animations stopped");
  } else {
    console.log("Invalid animation index");
  }
};

const speed = (newSpeed: number) => {
  state.speed = newSpeed;
  console.log(`Speed set to ${newSpeed}`);
};

///////////////////////////// Export Functions /////////////////////////////

const getPathImage = () => {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = state.canvas.width;
  tempCanvas.height = state.canvas.height;
  const tempCtx = tempCanvas.getContext("2d")!;

  // Clear the temporary canvas
  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw the path on the temporary canvas
  drawPath(
    tempCtx,
    state.path,
    state.horizontalPosition,
    state.square.verticalOffset,
    tempCanvas.width,
    tempCanvas.height,
    state.minX,
    state.maxX,
    state.minY,
    state.maxY
  );

  // Return the data URL of the temporary canvas
  return tempCanvas.toDataURL();
};

const exportSvg = () => {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");

  // Calculate the viewBox
  const padding = 10; // Add some padding
  const minX = Math.min(...state.path.map((p) => p.x)) - padding;
  const minY = Math.min(...state.path.map((p) => p.y)) - padding;
  const maxX = Math.max(...state.path.map((p) => p.x)) + padding;
  const maxY = Math.max(...state.path.map((p) => p.y)) + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
  svg.setAttribute("width", width.toString());
  svg.setAttribute("height", height.toString());

  // Create the path element
  const path = document.createElementNS(svgNS, "path");
  let d = `M ${state.path[0].x} ${state.path[0].y}`;
  for (let i = 1; i < state.path.length; i++) {
    d += ` L ${state.path[i].x} ${state.path[i].y}`;
  }
  path.setAttribute("d", d);
  path.setAttribute("stroke", "#090A02");
  path.setAttribute("fill", "none");
  svg.appendChild(path);

  // Create the square at its current position
  const square = document.createElementNS(svgNS, "rect");
  square.setAttribute("x", (state.horizontalPosition - 5).toString());
  square.setAttribute("y", (state.square.verticalOffset - 5).toString());
  square.setAttribute("width", "10");
  square.setAttribute("height", "10");
  square.setAttribute("fill", "#E03C17");
  svg.appendChild(square);

  // Convert SVG to a string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);

  // Create a Blob with the SVG string
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Create a download link and trigger the download
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "path_export.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // Clean up the object URL
  URL.revokeObjectURL(url);
};

// New export function
const dl = () => {
  const imageDataUrl = getPathImage();

  // Create a temporary anchor element
  const downloadLink = document.createElement("a");
  downloadLink.href = imageDataUrl;
  downloadLink.download = "canvas_capture.png";

  // Append to the body, click it, and remove it
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

///////////////////////////// Setup and Initialization /////////////////////////////

const setupEventListeners = () => {
  const codeInput = document.getElementById("code-input") as HTMLInputElement;

  const evaluateInput = async () => {
    const input = codeInput.value.trim();
    replHistory.push(input);
    if (input) {
      try {
        await smartExecuteCommands(input);
        evalHistory.push(input);
        console.log("Command(s) executed:", input);
      } catch (error) {
        console.error("Error executing command(s):", error);
      }
      codeInput.value = ""; // Clear the input field
    }
  };

  codeInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default form submission
      evaluateInput();
    }
  });
};

// Expose functions to the global scope for user interaction
(window as any).moveSquare = moveSquare;
(window as any).u = up;
(window as any).d = down;
(window as any).b = back;
(window as any).f = forward;
(window as any).w = wait;
(window as any).r = r;
(window as any).stop = stop;
(window as any).speed = speed;
(window as any).dlImg = dl;
(window as any).dlSvg = exportSvg;

setupEventListeners();
animate();

/**
 * colors
 * bg - E2E0CB
 * y - EBA51D
 * o - CF6347
 * b - 073C79
 * black - 090A02
 * r - E03C17
 */
