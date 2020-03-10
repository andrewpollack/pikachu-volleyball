/*
 *  X width: 432 = 0x1B0
 *  Y width: 304 = 0x130
 *
 *  X position coord: [0, 432], right-direction increasing
 *  Y position coord: [0, 304], down-direction increasing
 *
 *  Ball radius: 20 = 0x14
 *  Ball diameter: 40 = 0x28
 *
 *  Player half-width: 32 = 0x20
 *  Player half-height: 32 = 0x20
 *  Player width: 64 = 0x40
 *  Player height: 64 = 0x40
 *
 *  Game speed:
 *    slow: 1 frame per 33ms = 30.303030...Hz
 *    medium: 1 frame per 40ms = 25Hz
 *    fast: 1 frame per 50ms = 20Hz
 */
'use strict';
import { rand } from './rand.js';

/** @typedef {import("./pika_keyboard").PikaKeyboard} PikaKeyboard */

/**
 * Class representing a pack of physical objects i.e. players and ball
 * whose physical values are calculated and set by {@link physicsEngine} function
 */
export class PikaPhysics {
  /**
   * Create a physics pack
   * @param {boolean} isComputer1 Is player on the left (player 1) controlled by computer?
   * @param {boolean} isComputer2 Is player on the right (player 2) controlled by computer?
   */
  constructor(isComputer1, isComputer2) {
    this.player1 = new Player(false, isComputer1);
    this.player2 = new Player(true, isComputer2);
    this.ball = new Ball();
  }

  /**
   * Initialize players and ball for new round
   * @param {boolean} isPlayer2Serve Will player on the right side serve on this new round?
   */
  initializeForNewRound(isPlayer2Serve) {
    this.player1.initializeForNewRound();
    this.player2.initializeForNewRound();
    this.ball.initializeForNewRound(isPlayer2Serve);
  }

  /**
   * run {@link physicsEngine} function with this physics object and keyboard input
   *
   * @param {PikaKeyboard[]} keyboardArray keyboardArray[0]: PikaKeyboard object for player 1, keyboardArray[1]: PikaKeyboard object for player 2
   * @return {boolean} Is ball touching ground?
   */
  runEngineForNextFrame(keyboardArray) {
    const isBallTouchingGournd = physicsEngine(
      this.player1,
      this.player2,
      this.ball,
      keyboardArray
    );
    return isBallTouchingGournd;
  }
}

/**
 * Class representing a player
 * For initial values: refer FUN_000403a90 && FUN_00401f40
 */
class Player {
  /**
   * create a player
   * @param {boolean} isPlayer2 Is this player on the right side?
   * @param {boolean} isComputer Is this player controlled by computer?
   */
  constructor(isPlayer2, isComputer) {
    /** @type {boolean} Is this player on the right side? */
    this.isPlayer2 = isPlayer2; // 0xA0
    /** @type {boolean} Is controlled by computer? */
    this.isComputer = isComputer; // 0xA4
    this.initializeForNewRound();

    /** @type {number} -1: left, 0: no diving, 1: right */
    this.divingDirection = 0; // 0xB4
    /** @type {number} */
    this.lyingDownDurationLeft = -1; // 0xB8
    /** @type {boolean} */
    this.isWinner = false; // 0xD0
    /** @type {boolean} */
    this.gameEnded = false; // 0xD4

    /**
     * It flips randomly to 0 or 1 by the {@link letComputerDecideKeyboardPress} function (FUN_00402360)
     * when ball is hanging around on the other player's side.
     * If it is 0, computer player stands by around the middle point of their side.
     * If it is 1, computer player stands by adjecent to the net.
     * @type {number} 0 or 1
     */
    this.computerWhereToStandBy = 0; // 0xDC

    // TODO: stereo sound
    /**
     * This property is not in the player pointers of the original source code.
     * But for sound effect (especially for stereo sound(it is TODO, not implemented)),
     * it is convinient way to give sound property to a Player.
     * The original name is stereo sound.
     * @type {Object.<string, boolean>}
     */
    this.sound = {
      pipikachu: false,
      pika: false,
      chu: false
    };
  }

  /**
   * initialize for new round
   */
  initializeForNewRound() {
    /** @type {number} x coord */
    this.x = 36; // 0xA8 // initialized to 36 (player1) or 396 (player2)
    if (this.isPlayer2) {
      this.x = 396;
    }
    /** @type {number} y coord */
    this.y = 244; // 0xAC   // initialized to 244
    /** @type {number} y direction velocity */
    this.yVelocity = 0; // 0xB0  // initialized to 0
    /** @type {boolean} */
    this.isCollisionWithBallHappened = false; // 0xBC   // initizlized to 0 i.e false

    /**
     * Player's state
     * 0: normal, 1: jumping, 2: jumping_and_power_hitting, 3: diving
     * 4: lying_down_after_diving
     * 5: win!, 6: lost..
     * @type {number} 0, 1, 2, 3, 4 or 5
     */
    this.state = 0; // 0xC0   // initialized to 0
    /** @type {number} */
    this.frameNumber = 0; // 0xC4   // initialized to 0
    /** @type {number} */
    this.normalStatusArmSwingDirection = 1; // 0xC8  // initialized to 1
    /** @type {number} */
    this.delayBeforeNextFrame = 0; // 0xCC  // initizlized to 0

    /**
     * This value is initialized to (_rand() % 5) before the start of every round.
     * The greater the number, the bolder the computer player.
     *
     * If computer has higher boldness,
     * judges more the ball is haing around the other player's side,
     * has greater distance to the expected landing point of the ball,
     * jumps more,
     * dives less.
     * See the source code of the {@link letComputerDecideKeyboardPress} function (FUN_00402360).
     *
     * @type {number} 0, 1, 2, 3 or 4
     */
    this.computerBoldness = rand() % 5; // 0xD8  // initialized to (_rand() % 5)
  }
}

/**
 * Class representing a ball
 * For initial Values: refer FUN_000403a90 && FUN_00402d60
 */
class Ball {
  constructor(isPlayer2Serve) {
    this.initializeForNewRound(isPlayer2Serve);
    /** @type {number} x coord of expected lang point */
    this.expectedLandingPointX = 0; // 0x40
    /**
     * ball rotation frame number selector
     * During the period where it continues to be 5, hyper ball glitch occur.
     * @type {number} 0, 1, 2, 3, 4 or 5
     * */
    this.rotation = 0; // 0x44
    /** @type {number} */
    this.fineRotation = 0; // 0x48
    /** @type {number} x coord for punch effect */
    this.punchEffectX = 0; // 0x50
    /** @type {number} y coord for punch effect */
    this.punchEffectY = 0; // 0x54

    /**
     * Following previous values are for trailing effect for power hit
     * @type {number}
     */
    this.previousX = 0; // 0x58
    this.previousPreviousX = 0; // 0x5c
    this.previousY = 0; // 0x60
    this.previousPreviousY = 0; // 0x64

    // TODO: stereo sound
    /**
     * this property is not in the ball pointer of the original source code.
     * But for sound effect (especially for stereo sound(it is TODO, not implemented)),
     * it is convinient way to give sound property to a Ball.
     * The original name is stereo sound.
     */
    this.sound = {
      powerHit: false,
      ballTouchesGround: false
    };
  }

  /**
   * Initialize for new round
   * @param {boolean} isPlayer2Serve will player on the right side serve on this new round?
   */
  initializeForNewRound(isPlayer2Serve) {
    /** @type {number} x coord */
    this.x = 56; // 0x30    // initialized to 56 or 376
    if (isPlayer2Serve === true) {
      this.x = 376;
    }
    /** @type {number} y coord */
    this.y = 0; // 0x34   // initialized to 0
    /** @type {number} x direction velocity */
    this.xVelocity = 0; // 0x38  // initialized to 0
    /** @type {number} y directin velicity */
    this.yVelocity = 1; // 0x3C  // initialized to 1
    /** @type {number} punch effect radius */
    this.punchEffectRadius = 0; // 0x4c // initialized to 0
    /** @type {boolean} is power hit */
    this.isPowerHit = false; // 0x68  // initialized to 0 i.e. false
  }
}

/**
 * FUN_00403dd0
 * This is the Pikachu Volleyball physics engine!
 * This physics engine calculates and set the physics values for the next frame.
 *
 * @param {Player} player1 player on the left side
 * @param {Player} player2 player on the right side
 * @param {Ball} ball ball
 * @param {PikaKeyboard[]} keyboardArray keyboardArray[0]: keyboard for player 1, keyboardArray[1]: keyboard for player 2
 * @return {boolean} Is ball tounching ground?
 */
function physicsEngine(player1, player2, ball, keyboardArray) {
  const isBallTouchingGround = processCollisionBetweenBallAndWorldAndSetBallPosition(
    ball
  );

  let player;
  let theOtherPlayer;
  for (let i = 0; i < 2; i++) {
    if (i == 0) {
      player = player1;
      theOtherPlayer = player2;
    } else {
      player = player2;
      theOtherPlayer = player1;
    }

    // FUN_00402d90 ommited
    // FUN_00402810 ommited
    // this javascript code is refactored not to need above two function except for
    // a part of FUN_00402d90:
    // FUN_00402d90 include FUN_004031b0(caculate_expected_landing_point_x_for)
    caculate_expected_landing_point_x_for(ball); // calculate expected_X;

    processPlayerMovementAndSetPlayerPosition(
      player,
      keyboardArray[i],
      theOtherPlayer,
      ball
    );

    // FUN_00402830 ommited
    // FUN_00406020 ommited
    // tow function ommited above maybe participates in graphic drawing for a player
  }

  for (let i = 0; i < 2; i++) {
    if (i == 0) {
      player = player1;
    } else {
      player = player2;
    }

    // FUN_00402810 ommited: this javascript code is refactored not to need this function

    const is_happend = isCollisionBetweenBallAndPlayerHappened(
      ball,
      player.x,
      player.y
    );
    if (is_happend === true) {
      if (player.isCollisionWithBallHappened === false) {
        processCollisionBetweenBallAndPlayer(
          ball,
          player.x,
          keyboardArray[i],
          player.state
        );
        player.isCollisionWithBallHappened = true;
      }
    } else {
      player.isCollisionWithBallHappened = false;
    }
  }

  // FUN_00403040
  // FUN_00406020
  // tow function ommited above maybe participates in graphic drawing for a ball

  return isBallTouchingGround;
}

/**
 * FUN_00403070
 * Is collision between ball and player happend?
 * @param {Ball} ball
 * @param {Player["x"]} playerX player.x
 * @param {Player["y"]} playerY player.y
 * @return {boolean}
 */
function isCollisionBetweenBallAndPlayerHappened(ball, playerX, playerY) {
  let diff = ball.x - playerX;
  if (Math.abs(diff) < 33) {
    diff = ball.y - playerY;
    if (Math.abs(diff) < 33) {
      return true;
    }
  }
  return false;
}

/**
 * FUN_00402dc0
 * Process collision between ball and world and set ball position
 * @param {Ball} ball
 * @return {boolean} Is ball touching ground?
 */
function processCollisionBetweenBallAndWorldAndSetBallPosition(ball) {
  let futureFineRotation = ball.fineRotation + ball.xVelocity / 2;
  // If futureFineRotation === 50, it skips next if statement finely.
  // Then ball.fineRoation = 50, and then ball.rotation = 5 (which designates hyperball sprite!).
  // In this way, hyper ball glitch occur!
  // If this happen at the end of round,
  // since ball.xVeloicy is 0-initailized at each start of round,
  // hyper ball sprite is rendered continuously until a collision happens.
  if (futureFineRotation < 0) {
    futureFineRotation += 50;
  } else if (futureFineRotation > 50) {
    futureFineRotation += -50;
  }
  ball.fineRotation = futureFineRotation;
  ball.rotation = (ball.fineRotation / 10) >> 0; // integer division

  const futureBallX = ball.x + ball.xVelocity;
  // If the center of ball would get out of left world bound or right world bound
  //
  // TODO:
  // futureBallX > 432 should be changed to futureBallX > (432 - 20)
  // [maybe upper one is more possible when seeing pikachu player's x-direction boundary]
  // or, futureBallX < 20 should be changed to futureBallX < 0
  // I think this is a mistake of the author of the original game.
  if (futureBallX < 20 || futureBallX > 432) {
    ball.xVelocity = -ball.xVelocity;
  }

  let futureBallY = ball.y + ball.yVelocity;
  // if the center of ball would get out of upper world bound
  if (futureBallY < 0) {
    ball.yVelocity = 1;
  }

  // If ball touches net
  if (Math.abs(ball.x - 216) < 25 && ball.y > 176) {
    if (ball.y < 193) {
      if (ball.yVelocity > 0) {
        ball.yVelocity = -ball.yVelocity;
      }
    } else {
      if (ball.x < 216) {
        ball.xVelocity = -Math.abs(ball.xVelocity);
      } else {
        ball.xVelocity = Math.abs(ball.xVelocity);
      }
    }
  }

  futureBallY = ball.y + ball.yVelocity;
  // if ball would touch ground
  if (futureBallY > 252) {
    // FUN_00408470 omitted
    // the function omitted above receives 100 * (ball.x - 216),
    // i.e. horizontal displacement from net maybe for stereo sound?
    // code function (ballpointer + 0x28 + 0x10)? omitted
    // the omitted two functions maybe do a part of sound playback role.
    ball.sound.ballTouchesGround = true;

    ball.yVelocity = -ball.yVelocity;
    ball.punchEffectX = ball.x;
    ball.y = 252;
    ball.punchEffectRadius = 20;
    ball.punchEffectY = 272;
    return true;
  }
  ball.y = futureBallY;
  ball.x = ball.x + ball.xVelocity;
  ball.yVelocity += 1;

  // This is not part of this function in the original assembly code.
  // In the original assembly code, it is processed in other function (FUN_00402ee0)
  // But it is proper to process here.
  ball.previousPreviousX = ball.previousX;
  ball.previousPreviousY = ball.previousY;
  ball.previousX = ball.x;
  ball.previousY = ball.y;

  return false;
}

/**
 * FUN_00401fc0
 * Process player movement according to keyboard inpu and set player position
 * @param {Player} player
 * @param {PikaKeyboard} keyboard
 * @param {Player} theOtherPlayer
 * @param {Ball} ball
 */
function processPlayerMovementAndSetPlayerPosition(
  player,
  keyboard,
  theOtherPlayer,
  ball
) {
  if (player === null || ball === null) {
    return 0;
  }

  if (player.isComputer === true) {
    letComputerDecideKeyboardPress(player, ball, theOtherPlayer, keyboard);
  }

  // if player is lying down.. don't move
  if (player.state === 4) {
    player.lyingDownDurationLeft += -1;
    if (player.lyingDownDurationLeft < -1) {
      player.state = 0;
    }
    return 1;
  }

  // process x-direction movement
  let playerVelocityX = 0;
  if (player.state < 5) {
    if (player.state < 3) {
      playerVelocityX = keyboard.xDirection * 6;
    } else {
      // if player is diving..
      playerVelocityX = player.divingDirection * 8;
    }
  }

  const futurePlayerX = player.x + playerVelocityX;
  player.x = futurePlayerX;

  // process player's x-direction world boundary
  if (player.isPlayer2 === false) {
    // if player is player1
    if (futurePlayerX < 32) {
      player.x = 32;
    } else if (futurePlayerX > 216 - 32) {
      player.x = 216 - 32;
    }
  } else {
    // if player is player2
    if (futurePlayerX < 216 + 32) {
      player.x = 216 + 32;
    } else if (futurePlayerX > 432 - 32) {
      player.x = 432 - 32;
    }
  }

  // jump
  if (
    player.state < 3 &&
    keyboard.yDirection === -1 && // up-key downed
    player.y === 244 // player is touching on the ground
  ) {
    player.yVelocity = -16;
    player.state = 1;
    player.frameNumber = 0;
    // maybe-stereo-sound function FUN_00408470 (0x90) ommited:
    // refer a detailed comment above about this function
    // maybe-sound code function (playerpointer + 0x90 + 0x10)? ommited
    player.sound.chu = true;
  }

  // gravity
  const futurePlayerY = player.y + player.yVelocity;
  player.y = futurePlayerY;
  if (futurePlayerY < 244) {
    player.yVelocity += 1;
  } else if (futurePlayerY > 244) {
    // if player is landing..
    player.yVelocity = 0;
    player.y = 244;
    player.frameNumber = 0;
    if (player.state === 3) {
      // if player is diving..
      player.state = 4;
      player.frameNumber = 0;
      player.lyingDownDurationLeft = 3;
    } else {
      player.state = 0;
    }
  }

  if (keyboard.powerHit === 1) {
    if (player.state === 1) {
      // if player is jumping..
      // then player do power hit!
      player.delayBeforeNextFrame = 5;
      player.frameNumber = 0;
      player.state = 2;
      // maybe-sound function (playerpointer + 0x90 + 0x18)? ommited
      // maybe-stereo-sound function FUN_00408470 (0x90) ommited:
      // refer a detailed comment above about this function
      // maybe-sound function (playerpointer + 0x90 + 0x14)? ommited
      player.sound.pika = true;
    } else if (player.state === 0 && keyboard.xDirection !== 0) {
      // then player do diving!
      player.state = 3;
      player.frameNumber = 0;
      player.divingDirection = keyboard.xDirection;
      player.yVelocity = -5;
      // maybe-stereo-sound function FUN_00408470 (0x90) ommited:
      // refer a detailed comment above about this function
      // maybe-sound code function (playerpointer + 0x90 + 0x10)? ommited
      player.sound.chu = true;
    }
  }

  if (player.state === 1) {
    player.frameNumber = (player.frameNumber + 1) % 3;
  } else if (player.state === 2) {
    if (player.delayBeforeNextFrame < 1) {
      player.frameNumber += 1;
      if (player.frameNumber > 4) {
        player.frameNumber = 0;
        player.state = 1;
      }
    } else {
      player.delayBeforeNextFrame -= 1;
    }
  } else if (player.state === 0) {
    player.delayBeforeNextFrame += 1;
    if (player.delayBeforeNextFrame > 3) {
      player.delayBeforeNextFrame = 0;
      const futureFrameNumber =
        player.frameNumber + player.normalStatusArmSwingDirection;
      if (futureFrameNumber < 0 || futureFrameNumber > 4) {
        player.normalStatusArmSwingDirection = -player.normalStatusArmSwingDirection;
      }
      player.frameNumber =
        player.frameNumber + player.normalStatusArmSwingDirection;
    }
  }

  if (player.gameEnded === true) {
    if (player.state === 0) {
      if (player.isWinner === true) {
        player.state = 5;
        // maybe-stereo-sound function FUN_00408470 (0x90) ommited:
        // refer a detailed comment above about this function
        // maybe-sound code function (0x98 + 0x10) ommited
        player.sound.pipikachu = true;
      } else {
        player.state = 6;
      }
      player.delayBeforeNextFrame = 0;
      player.frameNumber = 0;
    }
    processGameEndFrameFor(player);
  }
  return 1;
}

/**
 * FUN_004025e0
 * Process game end frame (for winner and loser motions) for the given player
 * @param {Player} player
 */
function processGameEndFrameFor(player) {
  if (player.gameEnded === true && player.frameNumber < 4) {
    player.delayBeforeNextFrame += 1;
    if (player.delayBeforeNextFrame > 4) {
      player.delayBeforeNextFrame = 0;
      player.frameNumber += 1;
    }
    return 1;
  }
  return 0;
}

/**
 * FUN_004030a0
 * Process collision between ball and player.
 * This function only sets velocity of ball and expected landing point x of ball.
 * This function does not set position of ball.
 * The ball position is set by {@link processCollisionBetweenBallAndWorldAndSetBallPosition} function
 *
 * @param {Ball} ball
 * @param {Player["x"]} playerX
 * @param {PikaKeyboard} keyboard
 * @param {Player["state"]} playerState
 */
function processCollisionBetweenBallAndPlayer(
  ball,
  playerX,
  keyboard,
  playerState
) {
  // playerX is maybe pika's x position
  // if collision occur,
  // greater the x position difference between pika and ball,
  // greater the x velocity of the ball.
  if (ball.x < playerX) {
    // Since javascript division is float division by default
    // I use "Math.floor" to do integer division
    ball.xVelocity = -Math.floor(Math.abs(ball.x - playerX) / 3);
  } else if (ball.x > playerX) {
    ball.xVelocity = Math.floor(Math.abs(ball.x - playerX) / 3);
  }

  // If ball velocity x is 0, randomly choose one of -1, 0, 1.
  if (ball.xVelocity === 0) {
    ball.xVelocity = (rand() % 3) - 1;
  }

  const ballAbsYVelocity = Math.abs(ball.yVelocity);
  ball.yVelocity = -ballAbsYVelocity;

  if (ballAbsYVelocity < 15) {
    ball.yVelocity = -15;
  }

  // player is jumping and power hitting
  if (playerState === 2) {
    if (ball.x < 216) {
      ball.xVelocity = (Math.abs(keyboard.xDirection) + 1) * 10;
    } else {
      ball.xVelocity = -(Math.abs(keyboard.xDirection) + 1) * 10;
    }
    ball.punchEffectX = ball.x;
    ball.punchEffectY = ball.y;

    ball.yVelocity = Math.abs(ball.yVelocity) * keyboard.yDirection * 2;
    ball.punchEffectRadius = 20;
    // maybe-stereo-sound function FUN_00408470 (0x90) ommited:
    // refer a detailed comment above about this function
    // maybe-soundcode function (ballpointer + 0x24 + 0x10) ommited:
    ball.sound.powerHit = true;

    ball.isPowerHit = true;
  } else {
    ball.isPowerHit = false;
  }

  caculate_expected_landing_point_x_for(ball);

  return 1;
}

/**
 * FUN_004031b0
 * Calculate x coordinate of expected landing point of the ball
 * @param {Ball} ball
 */
function caculate_expected_landing_point_x_for(ball) {
  const copyBall = {
    x: ball.x,
    y: ball.y,
    xVelocity: ball.xVelocity,
    yVelocity: ball.yVelocity
  };
  while (true) {
    const futureCopyBallX = copyBall.xVelocity + copyBall.x;
    if (futureCopyBallX < 20 || futureCopyBallX > 432) {
      copyBall.xVelocity = -copyBall.xVelocity;
    }
    if (copyBall.y + copyBall.yVelocity < 0) {
      copyBall.yVelocity = 1;
    }

    // If copy ball touches net
    if (Math.abs(copyBall.x - 216) < 25 && copyBall.y > 176) {
      // TODO: it maybe should be 193 as in process_collision_with_ball_and_world function
      // original author's mistake?
      if (copyBall.y < 192) {
        if (copyBall.yVelocity > 0) {
          copyBall.yVelocity = -copyBall.yVelocity;
        }
      } else {
        if (copyBall.x < 216) {
          copyBall.xVelocity = -Math.abs(copyBall.xVelocity);
        } else {
          copyBall.xVelocity = Math.abs(copyBall.xVelocity);
        }
      }
    }

    copyBall.y = copyBall.y + copyBall.yVelocity;
    // if copyBall would touch ground
    if (copyBall.y > 252) {
      break;
    }
    copyBall.x = copyBall.x + copyBall.xVelocity;
    copyBall.yVelocity += 1;
  }
  ball.expectedLandingPointX = copyBall.x;
  return 1;
}

// TODO: Math.abs(ball.x - player.x) appears too many.. refactor!
/**
 * FUN_00402360
 * Computer control player by this function.
 * Computer decides which keys (of the given keyboard) to press
 * according to the game situation it figure out
 * by the given player, ball and theOtherplayer parameter,
 * and reflects this to the given keyboard object.
 *
 * @param {Player} player The player whom computer contorls
 * @param {Ball} ball ball
 * @param {Player} theOtherPlayer The other player
 * @param {PikaKeyboard} keyboard keyboard of the player whom computer controls
 */
function letComputerDecideKeyboardPress(
  player,
  ball,
  theOtherPlayer,
  keyboard
) {
  keyboard.xDirection = 0;
  keyboard.yDirection = 0;
  keyboard.powerHit = 0;
  // TODO what is 4th property?? of keyboard??

  let virtualExpectedLandingPointX = ball.expectedLandingPointX;
  if (
    Math.abs(ball.x - player.x) > 100 &&
    Math.abs(ball.xVelocity) < player.computerBoldness + 5
  ) {
    const leftBoundary = Number(player.isPlayer2) * 216;
    if (
      (ball.expectedLandingPointX <= leftBoundary ||
        ball.expectedLandingPointX >= Number(player.isPlayer2) * 432 + 216) &&
      player.computerWhereToStandBy === 0
    ) {
      virtualExpectedLandingPointX = leftBoundary + 216 / 2;
    }
  }

  if (
    Math.abs(virtualExpectedLandingPointX - player.x) >
    player.computerBoldness + 8
  ) {
    if (player.x < virtualExpectedLandingPointX) {
      keyboard.xDirection = 1;
    } else {
      keyboard.xDirection = -1;
    }
  } else if (rand() % 20 === 0) {
    player.computerWhereToStandBy = rand() % 2;
  }

  if (player.state === 0) {
    if (
      Math.abs(ball.xVelocity) < player.computerBoldness + 3 &&
      Math.abs(ball.x - player.x) < 32 &&
      ball.y > -36 &&
      ball.y < 10 * player.computerBoldness + 84 &&
      ball.yVelocity > 0
    ) {
      keyboard.yDirection = -1;
    }

    const leftBoundary = Number(player.isPlayer2) * 216;
    const rightBoundary = (Number(player.isPlayer2) + 1) * 216;
    if (
      ball.expectedLandingPointX > leftBoundary &&
      ball.expectedLandingPointX < rightBoundary &&
      Math.abs(ball.x - player.x) > player.computerBoldness * 5 + 64 &&
      ball.x > leftBoundary &&
      ball.x < rightBoundary &&
      ball.y > 174
    ) {
      keyboard.powerHit = 1;
      if (player.x < ball.x) {
        keyboard.xDirection = 1;
      } else {
        keyboard.xDirection = -1;
      }
    }
  } else if (player.state === 1 || player.state === 2) {
    if (Math.abs(ball.x - player.x) > 8) {
      if (player.x < ball.x) {
        keyboard.xDirection = 1;
      } else {
        keyboard.xDirection = -1;
      }
    }
    if (Math.abs(ball.x - player.x) < 48 && Math.abs(ball.y - player.y) < 48) {
      const willPressPowerHitKey = decideWhetherPressPowerHitKey(
        player,
        ball,
        theOtherPlayer,
        keyboard
      );
      if (willPressPowerHitKey === 1) {
        keyboard.powerHit = 1;
        if (
          Math.abs(theOtherPlayer.x - player.x) < 80 &&
          keyboard.yDirection !== -1
        ) {
          keyboard.yDirection = -1;
        }
      }
    }
  }
}

/**
 * FUN_00402630
 * This function is called by {@link letComputerDecideKeyboardPress},
 * and also sets keyboard key press so that it participate in
 * the decision of the direction of power hit.
 * @param {Player} player the player whom computer controls
 * @param {Ball} ball ball
 * @param {Player} theOtherPlayer The other player
 * @param {PikaKeyboard} keyboard keyboard of the player whom computer controls
 */
function decideWhetherPressPowerHitKey(player, ball, theOtherPlayer, keyboard) {
  if (rand() % 2 === 0) {
    for (let xDirection = 1; xDirection > -1; xDirection--) {
      for (let yDirection = -1; yDirection < 2; yDirection++) {
        const expectedLandingPointX = expectedLandingPointXWhenPowerHit(
          xDirection,
          yDirection,
          ball
        );
        if (
          (expectedLandingPointX <= Number(player.isPlayer2) * 216 ||
            expectedLandingPointX >= Number(player.isPlayer2) * 432 + 216) &&
          Math.abs(expectedLandingPointX - theOtherPlayer.x) > 64
        ) {
          keyboard.xDirection = xDirection;
          keyboard.yDirection = yDirection;
          return 1;
        }
      }
    }
  } else {
    for (let xDirection = 1; xDirection > -1; xDirection--) {
      for (let yDirection = 1; yDirection > -2; yDirection--) {
        const expectedLandingPointX = expectedLandingPointXWhenPowerHit(
          xDirection,
          yDirection,
          ball
        );
        if (
          (expectedLandingPointX <= Number(player.isPlayer2) * 216 ||
            expectedLandingPointX >= Number(player.isPlayer2) * 432 + 216) &&
          Math.abs(expectedLandingPointX - theOtherPlayer.x) > 64
        ) {
          keyboard.xDirection = xDirection;
          keyboard.yDirection = yDirection;
          return 1;
        }
      }
    }
  }
  return 0;
}

// FUN_00402870
/**
 * This function is called by {@link decideWhetherPressPowerHitKey},
 * and calculates the expected x coordinate of the landing point of the ball
 * when power hit
 * @param {PikaKeyboard["xDirection"]} keyboardXDirection
 * @param {PikaKeyboard["yDirection"]} keyboardYDirection
 * @param {Ball} ball
 */
function expectedLandingPointXWhenPowerHit(
  keyboardXDirection,
  keyboardYDirection,
  ball
) {
  const copyBall = {
    x: ball.x,
    y: ball.y,
    xVelocity: ball.xVelocity,
    yVelocity: ball.yVelocity
  };
  if (copyBall.x < 216) {
    copyBall.xVelocity = (Math.abs(keyboardXDirection) + 1) * 10;
  } else {
    copyBall.xVelocity = -(Math.abs(keyboardXDirection) + 1) * 10;
  }
  copyBall.yVelocity = Math.abs(copyBall.yVelocity) * keyboardYDirection * 2;

  while (true) {
    const futureCopyBallX = copyBall.x + copyBall.xVelocity;
    if (futureCopyBallX < 20 || futureCopyBallX > 432) {
      copyBall.xVelocity = -copyBall.xVelocity;
    }
    if (copyBall.y + copyBall.yVelocity < 0) {
      copyBall.yVelocity = 1;
    }
    if (Math.abs(copyBall.x - 216) < 25 && copyBall.y > 176) {
      /*
        TODO: is it real??
        it's just same as

        if (copyBall.yVelocity > 0) {
          copyBall.yVelocity = -copyBall.yVelocity;
        }

        maybe this is mistake of the original author....

        Or is it for making AI doing mistakes??
      */
      if (copyBall.y < 193) {
        if (copyBall.yVelocity > 0) {
          copyBall.yVelocity = -copyBall.yVelocity;
        }
      } else if (copyBall.yVelocity > 0) {
        copyBall.yVelocity = -copyBall.yVelocity;
      }

      // The one for AI not doing those mistakes is as below.

      // if (copyBall.y < 193) {
      //   if (copyBall.yVelocity > 0) {
      //     copyBall.yVelocity = -copyBall.yVelocity;
      //   }
      // } else {
      //   if (copyBall.x < 216) {
      //     copyBall.xVelocity = -Math.abs(copyBall.xVelocity);
      //   } else {
      //     copyBall.xVelocity = Math.abs(copyBall.xVelocity);
      //   }
      // }
    }
    copyBall.y = copyBall.y + copyBall.yVelocity;
    if (copyBall.y > 252) {
      return copyBall.x;
    }
    copyBall.x = copyBall.x + copyBall.xVelocity;
    copyBall.yVelocity += 1;
  }
}