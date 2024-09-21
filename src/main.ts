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

const updateSquarePosition = (state: AppState, dy: number): AppState => {
  const newVerticalOffset = state.square.verticalOffset + dy;
  const newPath = [
    ...state.path,
    { x: state.horizontalPosition, y: newVerticalOffset },
  ];
  return {
    ...state,
    square: { ...state.square, verticalOffset: newVerticalOffset },
    path: newPath,
    minX: Math.min(state.minX, state.horizontalPosition),
    maxX: Math.max(state.maxX, state.horizontalPosition),
    minY: Math.min(state.minY, newVerticalOffset),
    maxY: Math.max(state.maxY, newVerticalOffset),
  };
};

const drawSquare = (
  ctx: CanvasRenderingContext2D,
  square: Square,
  canvasWidth: number,
  canvasHeight: number
) => {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  ctx.fillStyle = "red";
  ctx.fillRect(
    centerX - square.size / 2,
    centerY - square.size / 2,
    square.size,
    square.size
  );
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

// Expose functions to the global scope for user interaction
(window as any).moveSquare = (direction: "up" | "down", distance: number) => {
  const dy = direction === "up" ? -distance : distance;
  state = updateSquarePosition(state, dy);
};

setupEventListeners();
animate();
