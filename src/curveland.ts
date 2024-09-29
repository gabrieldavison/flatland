import "./style.css";

interface Point {
  x: number;
  y: number;
}
interface Square {
  position: Point;
  velocity: Point;
}
interface AppState {
  square: Square;
  path: Point[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
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

let state: AppState;
let commandLoops: CommandLoop[] = [];
let replHistory: string[] = [];

const initState = (): AppState => {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  return {
    square: {
      position: { x: canvas.width / 2, y: canvas.height / 2 },
      velocity: { x: 0, y: 0 },
    },
    path: [{ x: canvas.width / 2, y: canvas.height / 2 }],
    canvas,
    ctx,
    minX: canvas.width / 2,
    maxX: canvas.width / 2,
    minY: canvas.height / 2,
    maxY: canvas.height / 2,
    frameCount: 0,
    speed: 1,
    isStarted: false,
  };
};

const updateSquarePosition = (state: AppState): AppState => {
  const { square, speed } = state;
  const newPosition = {
    x: square.position.x + square.velocity.x * speed,
    y: square.position.y + square.velocity.y * speed,
  };
  return {
    ...state,
    square: { ...square, position: newPosition },
    path: [...state.path, newPosition],
    minX: Math.min(state.minX, newPosition.x),
    maxX: Math.max(state.maxX, newPosition.x),
    minY: Math.min(state.minY, newPosition.y),
    maxY: Math.max(state.maxY, newPosition.y),
    frameCount: state.frameCount + 1,
  };
};

const applyForce = (
  state: AppState,
  magnitude: number,
  angle: number
): AppState => {
  const radians = angle * (Math.PI / 180);
  const forceX = magnitude * Math.cos(radians);
  const forceY = magnitude * Math.sin(radians);
  return {
    ...state,
    square: {
      ...state.square,
      velocity: {
        x: state.square.velocity.x + forceX,
        y: state.square.velocity.y - forceY,
      },
    },
  };
};

const drawPath = (state: AppState) => {
  const { ctx, path, square, canvas, minX, maxX, minY, maxY } = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#090A02";
  ctx.beginPath();

  const scale =
    Math.min(canvas.width / (maxX - minX), canvas.height / (maxY - minY)) * 0.8;
  const offsetX = (canvas.width - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (canvas.height - (maxY - minY) * scale) / 2 - minY * scale;

  path.forEach((point, index) => {
    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#E03C17";
  ctx.fillRect(
    square.position.x * scale + offsetX - 5,
    square.position.y * scale + offsetY - 5,
    10,
    10
  );
};

const animate = () => {
  if (state.isStarted) {
    state = updateSquarePosition(state);
    drawPath(state);
  }
  updateUi();
  requestAnimationFrame(animate);
};

const updateUi = () => {
  const commandHistoryRoot = document.getElementById(
    "command-history"
  ) as HTMLElement;
  const replHistoryRoot = document.getElementById(
    "repl-history"
  ) as HTMLElement;
  commandHistoryRoot.innerHTML = commandLoops
    .map((loop, i) => `<div>${i}: ${loop.commands.join(" | ")}</div>`)
    .join("");
  replHistoryRoot.innerHTML = replHistory
    .map((item) => `<div>${item}</div>`)
    .join("");
};

const executeCommands = async (commands: string[]) => {
  for (const cmd of commands) {
    if (cmd.startsWith("f") || cmd.startsWith("force")) {
      const [magnitude, angle] = cmd
        .slice(cmd.indexOf("f") + 1)
        .split(",")
        .map(Number);
      state = applyForce(state, magnitude, angle);
    } else if (cmd.startsWith("w")) {
      await new Promise<void>((resolve) => {
        const targetFrame =
          state.frameCount + parseInt(cmd.slice(1)) / state.speed;
        const checkFrame = () =>
          state.frameCount >= targetFrame
            ? resolve()
            : requestAnimationFrame(checkFrame);
        checkFrame();
      });
    }
  }
};

const smartExecuteCommands = async (input: string) => {
  const commands = input.split(" ");
  if (!state.isStarted) state = { ...state, isStarted: true };

  if (commands.length === 1) {
    if (commands[0].startsWith("stop")) {
      stop(parseInt(commands[0].slice(4)));
    } else if (commands[0].startsWith("speed")) {
      state.speed = parseInt(commands[0].slice(5));
    } else {
      await executeCommands(commands);
    }
  } else {
    r(input);
  }
};

const r = (commandString: string) => {
  const commands = commandString.split(" ");
  const commandLoop: CommandLoop = { id: null, commands, stopRequest: false };
  const loop = async () => {
    if (commandLoop.stopRequest) {
      commandLoop.id = null;
      return;
    }
    await executeCommands(commandLoop.commands);
    commandLoop.id = requestAnimationFrame(loop);
  };
  commandLoop.id = requestAnimationFrame(loop);
  commandLoops.push(commandLoop);
};

const stop = (index?: number) => {
  if (index !== undefined && index >= 0 && index < commandLoops.length) {
    const commandLoop = commandLoops[index];
    if (commandLoop.id !== null) {
      commandLoop.stopRequest = true;
      cancelAnimationFrame(commandLoop.id);
      commandLoops = commandLoops.filter((val) => val.id !== commandLoop.id);
    }
  } else {
    commandLoops.forEach((loop) => {
      if (loop.id !== null) {
        loop.stopRequest = true;
        cancelAnimationFrame(loop.id);
        loop.id = null;
      }
    });
    commandLoops = [];
  }
};

const setupEventListeners = () => {
  const codeInput = document.getElementById("code-input") as HTMLInputElement;
  codeInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const input = codeInput.value.trim();
      replHistory.push(input);
      if (input) {
        await smartExecuteCommands(input);
        codeInput.value = "";
      }
    }
  });
};

state = initState();
setupEventListeners();
animate();
