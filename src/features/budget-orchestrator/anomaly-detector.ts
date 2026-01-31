export type AnomalyType = 'spike' | 'sustained_high' | 'sudden_drop'

export interface AnomalyResult {
  type: AnomalyType
  zScore: number
  value: number
  baseline: number
  threshold: number
  timestamp: Date
}

export interface AnomalyRecord extends AnomalyResult {
  id: string
  dismissed: boolean
}

export class AnomalyDetector {
  private mean: number = 0
  private m2: number = 0
  private count: number = 0
  private anomalies: AnomalyRecord[] = []
  private readonly zScoreThreshold: number

  constructor(zScoreThreshold: number = 2.0) {
    this.zScoreThreshold = zScoreThreshold
  }

  public detectAnomaly(currentSpend: number): AnomalyResult | null {
    if (this.count < 2) {
      return null // Need at least 2 samples for meaningful stdDev
    }

    const variance = this.m2 / this.count
    const stdDev = Math.sqrt(Math.max(0, variance))
    
    if (stdDev === 0) {
      return null // No variation detected yet
    }

    const zScore = (currentSpend - this.mean) / stdDev
    const absoluteZScore = Math.abs(zScore)

    if (absoluteZScore <= this.zScoreThreshold) {
      return null // Not anomalous
    }

    // Determine anomaly type
    let type: AnomalyType
    if (zScore > 0) {
      type = currentSpend > this.mean * 1.5 ? 'spike' : 'sustained_high'
    } else {
      type = 'sudden_drop'
    }

    return {
      type,
      zScore,
      value: currentSpend,
      baseline: this.mean,
      threshold: this.zScoreThreshold,
      timestamp: new Date()
    }
  }

  public updateBaseline(spend: number): void {
    // Welford's online algorithm for calculating running mean and variance
    this.count++
    const delta = spend - this.mean
    this.mean += delta / this.count
    const delta2 = spend - this.mean
    this.m2 += delta * delta2
  }

  public getAnomalies(): AnomalyRecord[] {
    return [...this.anomalies]
  }

  // Helper method to add detected anomaly to history
  private addAnomaly(anomaly: AnomalyResult): void {
    const record: AnomalyRecord = {
      ...anomaly,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dismissed: false
    }
    this.anomalies.push(record)
  }

  // Public method to detect and record anomalies
  public detectAndRecord(currentSpend: number): AnomalyRecord | null {
    const anomaly = this.detectAnomaly(currentSpend)
    if (anomaly) {
      this.addAnomaly(anomaly)
    }
    return anomaly ? this.anomalies[this.anomalies.length - 1] : null
  }
}