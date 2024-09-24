import "./style.css";

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
}

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
  };
};

let state = createInitialState();

const updateSquarePosition = (
  state: AppState,
  dx: number,
  dy: number
): AppState => {
  const newHorizontalPosition = state.horizontalPosition + dx;
  const newVerticalOffset = state.square.verticalOffset + dy;
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
  ctx.strokeStyle = "black";
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
  ctx.fillStyle = "red";
  ctx.fillRect(squareX - 10, squareY - 10, 20, 20);
};

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
  state = {
    ...state,
    horizontalPosition: state.horizontalPosition + 1,
    maxX: Math.max(state.maxX, state.horizontalPosition + 1),
    path: [
      ...state.path,
      { x: state.horizontalPosition + 1, y: state.square.verticalOffset },
    ],
  };
  render(state);
  requestAnimationFrame(animate);
};

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

const setupEventListeners = () => {
  const codeInput = document.getElementById("codeInput") as HTMLTextAreaElement;
  const runButton = document.getElementById("runButton") as HTMLButtonElement;
  const captureButton = document.getElementById(
    "captureButton"
  ) as HTMLButtonElement;

  runButton.addEventListener("click", () => {
    try {
      // Use with caution: eval can be dangerous if used with untrusted input
      eval(codeInput.value);
    } catch (error) {
      console.error("Error executing code:", error);
    }
  });

  captureButton.addEventListener("click", () => {
    const imageDataUrl = getPathImage();

    // Create a temporary anchor element
    const downloadLink = document.createElement("a");
    downloadLink.href = imageDataUrl;
    downloadLink.download = "canvas_capture.png";

    // Append to the body, click it, and remove it
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  });
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const repeat = async (times: number, commands: (() => Promise<void>)[]) => {
  for (let i = 0; i < times; i++) {
    for (const command of commands) {
      await command();
    }
  }
};

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
      throw new Error(`Unknown command: ${direction}`);
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

let animationId: number | null = null;

const r = (commandString: string) => {
  const commands = commandString.split(" ");

  const loop = async () => {
    await executeCommands(commands);
    animationId = requestAnimationFrame(loop);
  };

  // Cancel any existing animation before starting a new one
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }

  loop();
};

const stop = () => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
    console.log("Animation stopped");
  } else {
    console.log("No animation running");
  }
};
// Expose functions to the global scope for user interaction
(window as any).moveSquare = moveSquare;
(window as any).up = up;
(window as any).down = down;
(window as any).back = back;
(window as any).back = forward;
(window as any).repeat = repeat;
(window as any).wait = wait;
(window as any).r = r;
(window as any).stop = stop;

setupEventListeners();
animate();
