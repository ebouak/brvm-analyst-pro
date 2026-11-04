/** Numérote les recherches : une réponse arrivée après une recherche plus récente est ignorée. */
export class Sequenceur {
  private dernier = 0;

  suivante(): number {
    this.dernier += 1;
    return this.dernier;
  }

  estCourante(id: number): boolean {
    return id === this.dernier;
  }
}
