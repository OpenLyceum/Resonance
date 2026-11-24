/**
 * WebGLParticleRenderer.ts
 *
 * WebGL implementation of the ParticleRenderer interface.
 * Uses SceneryStack's Sprites system for efficient rendering of many particles.
 */

import { Bounds2, Vector2 } from "scenerystack/dot";
import type { ModelViewTransform2 } from "scenerystack/phetcommon";
import { Node, Sprite, SpriteImage, SpriteInstance, SpriteInstanceTransformType, Sprites } from "scenerystack/scenery";
import ResonanceColors from "../../../ResonanceColors.js";
import type { ParticleRenderer } from "./ParticleRenderer.js";

// Particle rendering size in pixels
const PARTICLE_SIZE = 2;

/**
 * WebGL particle renderer using Sprites for efficient rendering.
 */
export class WebGLParticleRenderer implements ParticleRenderer {
  private width: number;
  private height: number;
  // Container node that stays in the scene graph; sprites node is swapped inside it
  private readonly containerNode: Node;
  private spritesNode: Sprites | null = null;
  private sprite: Sprite | null = null;
  private spriteInstances: SpriteInstance[] = [];

  public constructor(width: number, height: number, _transform: ModelViewTransform2) {
    this.width = width;
    this.height = height;
    this.containerNode = new Node();
    this.initialize();
  }

  /**
   * Initialize the sprites system.
   */
  private initialize(): void {
    this.sprite = this.createParticleSprite();

    this.spritesNode = new Sprites({
      sprites: [this.sprite],
      spriteInstances: this.spriteInstances,
      canvasBounds: new Bounds2(0, 0, this.width, this.height),
      hitTestSprites: false,
      renderer: "webgl",
    });

    this.containerNode.addChild(this.spritesNode);
  }

  /**
   * Create a sprite image for a single particle.
   */
  private createParticleSprite(): Sprite {
    const canvas = document.createElement("canvas");
    const size = PARTICLE_SIZE * 2; // Extra space for anti-aliasing
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("A 2D canvas context is required to create particle sprites.");
    }
    const color = ResonanceColors.chladniParticleProperty.value;

    // Draw a filled circle
    context.beginPath();
    context.arc(size / 2, size / 2, PARTICLE_SIZE / 2, 0, Math.PI * 2);
    context.fillStyle = color.toCSS();
    context.fill();

    // Create sprite image with center offset
    const spriteImage = new SpriteImage(canvas, new Vector2(size / 2, size / 2));
    return new Sprite(spriteImage);
  }

  /**
   * Ensure we have the correct number of sprite instances.
   */
  private syncSpriteInstances(particleCount: number, sprite: Sprite): boolean {
    if (this.spriteInstances.length === particleCount) {
      return false;
    }

    // Clear existing instances
    this.spriteInstances.length = 0;

    // Create new instances
    for (let i = 0; i < particleCount; i++) {
      const instance = SpriteInstance.pool.fetch();
      instance.sprite = sprite;
      instance.transformType = SpriteInstanceTransformType.TRANSLATION;
      instance.alpha = 1.0;
      instance.matrix.setToIdentity();
      this.spriteInstances.push(instance);
    }

    return true;
  }

  /**
   * Recreate the sprites node (needed when instances change).
   */
  private recreateSpritesNode(): void {
    const sprite = this.sprite;
    if (sprite === null) {
      return;
    }
    // Remove old sprites node from container
    if (this.spritesNode) {
      this.containerNode.removeChild(this.spritesNode);
    }

    this.spritesNode = new Sprites({
      sprites: [sprite],
      spriteInstances: this.spriteInstances,
      canvasBounds: new Bounds2(0, 0, this.width, this.height),
      hitTestSprites: false,
      renderer: "webgl",
    });

    this.containerNode.addChild(this.spritesNode);
  }

  public getNode(): Node {
    return this.containerNode;
  }

  public update(particles: Vector2[], transform: ModelViewTransform2): void {
    const sprite = this.sprite;
    if (sprite === null) {
      return;
    }
    // Sync instance count
    const needsRecreate = this.syncSpriteInstances(particles.length, sprite);
    if (needsRecreate) {
      this.recreateSpritesNode();
    }

    // Update positions
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i]!;
      const instance = this.spriteInstances[i]!;
      const viewPos = transform.modelToViewPosition(particle);
      instance.matrix.setToTranslation(viewPos.x, viewPos.y);
    }

    this.spritesNode?.invalidatePaint();
  }

  public resize(width: number, height: number, _transform: ModelViewTransform2): void {
    this.width = width;
    this.height = height;
    this.recreateSpritesNode();
  }

  public onColorChange(): void {
    // Recreate sprite with new color
    this.sprite = this.createParticleSprite();

    // Update all instances to use new sprite
    for (const instance of this.spriteInstances) {
      instance.sprite = this.sprite;
    }

    this.recreateSpritesNode();
  }

  public dispose(): void {
    if (this.spritesNode) {
      this.containerNode.removeChild(this.spritesNode);
    }
    this.spriteInstances = [];
    this.spritesNode = null;
    this.sprite = null;
  }
}
