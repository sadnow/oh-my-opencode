import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AnomalyDetector } from './anomaly-detector'

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector

  beforeEach(() => {
    detector = new AnomalyDetector(2.0)
  })

  describe('Welford\'s Algorithm (Baseline Updates)', () => {
    it('should calculate mean accurately', () => {
      //#given
      const values = [10, 20, 30]
      
      //#when
      values.forEach(v => detector.updateBaseline(v))
      
      //#then
      // Mean should be 20
      const anomaly = detector.detectAnomaly(20)
      expect(anomaly).toBeNull() // 20 is exactly the mean
      
      // We can verify mean via detectAnomaly's returned baseline if we trigger an anomaly
      // or just trust the math if we can't access private members.
      // Since mean is private, we'll use detectAnomaly to observe it.
      const result = detector.detectAnomaly(100)
      expect(result?.baseline).toBe(20)
    })

    it('should calculate variance/stdDev accurately', () => {
      //#given
      // Values: 10, 20. Mean = 15. 
      // Variance = ((10-15)^2 + (20-15)^2) / 2 = (25 + 25) / 2 = 25
      // StdDev = 5
      detector.updateBaseline(10)
      detector.updateBaseline(20)
      
      //#when
      // Z-score for 26: (26 - 15) / 5 = 11 / 5 = 2.2
      const result = detector.detectAnomaly(26)
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.zScore).toBeCloseTo(2.2)
    })

    it('should not crash with single sample', () => {
      //#given
      detector.updateBaseline(10)
      
      //#when
      const result = detector.detectAnomaly(20)
      
      //#then
      expect(result).toBeNull() // Need at least 2 samples
    })

    it('should work with minimum two samples for stdDev', () => {
      //#given
      detector.updateBaseline(10)
      detector.updateBaseline(20)
      
      //#when
      const result = detector.detectAnomaly(30) // Z = (30-15)/5 = 3
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.zScore).toBe(3)
    })

    it('should handle many samples (100+)', () => {
      //#given
      for (let i = 0; i < 100; i++) {
        detector.updateBaseline(100)
      }
      detector.updateBaseline(200) // Add some variance
      
      //#when
      const result = detector.detectAnomaly(500)
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.value).toBe(500)
    })
  })

  describe('Z-Score Detection', () => {
    beforeEach(() => {
      // Setup baseline: Mean=100, StdDev=10
      // To get StdDev=10, Variance=100.
      // With 2 samples: 90, 110. Mean=100. Variance = ((90-100)^2 + (110-100)^2)/2 = (100+100)/2 = 100.
      detector.updateBaseline(90)
      detector.updateBaseline(110)
    })

    it('should not detect anomaly for normal spending', () => {
      //#given
      const spend = 105 // Z = (105-100)/10 = 0.5
      
      //#when
      const result = detector.detectAnomaly(spend)
      
      //#then
      expect(result).toBeNull()
    })

    it('should detect spike anomaly (Z > threshold, value > mean * 1.5)', () => {
      //#given
      const spend = 160 // Z = (160-100)/10 = 6.0. 160 > 100 * 1.5
      
      //#when
      const result = detector.detectAnomaly(spend)
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.type).toBe('spike')
      expect(result?.zScore).toBe(6)
    })

    it('should detect sustained_high anomaly (Z > threshold, value <= mean * 1.5)', () => {
      //#given
      const spend = 130 // Z = (130-100)/10 = 3.0. 130 <= 100 * 1.5
      
      //#when
      const result = detector.detectAnomaly(spend)
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.type).toBe('sustained_high')
      expect(result?.zScore).toBe(3)
    })

    it('should detect sudden_drop anomaly (Z < -threshold)', () => {
      //#given
      const spend = 70 // Z = (70-100)/10 = -3.0
      
      //#when
      const result = detector.detectAnomaly(spend)
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.type).toBe('sudden_drop')
      expect(result?.zScore).toBe(-3)
    })

    it('should return null if stdDev is 0', () => {
      //#given
      const flatDetector = new AnomalyDetector(2.0)
      flatDetector.updateBaseline(100)
      flatDetector.updateBaseline(100)
      
      //#when
      const result = flatDetector.detectAnomaly(200)
      
      //#then
      expect(result).toBeNull()
    })
  })

  describe('detectAndRecord', () => {
    it('should update baseline on each call', () => {
      //#given
      detector.updateBaseline(100)
      detector.updateBaseline(110) // Mean=105, StdDev=5
      
      //#when
      // To trigger anomaly, we need Z > 2.0.
      // Z = (spend - mean) / stdDev.
      // (spend - 105) / 5 > 2.0 => spend - 105 > 10 => spend > 115.
      // BUT detectAndRecord updates baseline FIRST.
      // If we use spend = 1000:
      // New Mean = (105*2 + 1000)/3 = 403.33
      // New M2 = oldM2 + (1000-105)*(1000-403.33) = 50 + 895 * 596.66 = 50 + 534010.7 = 534060.7
      // New Variance = 534060.7 / 3 = 178020.23
      // New StdDev = 421.9
      // Z = (1000 - 403.33) / 421.9 = 1.41 (Not an anomaly!)
      
      // We need a very large value to overcome the stdDev increase, or more stable baseline.
      // Let's use a more stable baseline.
      for(let i=0; i<10; i++) detector.updateBaseline(100);
      // Mean=100, StdDev=0. Add some variance.
      detector.updateBaseline(110); 
      // Now we have 11 samples.
      
      const result = detector.detectAndRecord(1000)
      
      //#then
      expect(result).not.toBeNull()
    })

    it('should record anomaly in history', () => {
      //#given
      for(let i=0; i<10; i++) detector.updateBaseline(100);
      detector.updateBaseline(110);
      
      //#when
      const result = detector.detectAndRecord(1000)
      
      //#then
      expect(result).not.toBeNull()
      expect(detector.getAnomalies()).toHaveLength(1)
      expect(detector.getAnomalies()[0].value).toBe(1000)
    })

    it('should return correct records from getAnomalies', () => {
      //#given
      for(let i=0; i<10; i++) detector.updateBaseline(100);
      detector.updateBaseline(110);
      
      //#when
      detector.detectAndRecord(1000)
      detector.detectAndRecord(2000)
      
      //#then
      const anomalies = detector.getAnomalies()
      expect(anomalies).toHaveLength(2)
      expect(anomalies[0].value).toBe(1000)
      expect(anomalies[1].value).toBe(2000)
    })
  })

  describe('Edge Cases', () => {
    it('should handle negative values', () => {
      //#given
      detector.updateBaseline(-100)
      detector.updateBaseline(-110)
      
      //#when
      const result = detector.detectAnomaly(-200)
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.type).toBe('sudden_drop')
    })

    it('should handle zero values', () => {
      //#given
      detector.updateBaseline(0)
      detector.updateBaseline(0)
      
      //#when
      const result = detector.detectAnomaly(100)
      
      //#then
      expect(result).toBeNull() // stdDev is 0
    })

    it('should respect configurable threshold', () => {
      //#given
      const strictDetector = new AnomalyDetector(1.0)
      strictDetector.updateBaseline(90)
      strictDetector.updateBaseline(110) // Mean=100, StdDev=10
      
      //#when
      const result = strictDetector.detectAnomaly(115) // Z = 1.5
      
      //#then
      expect(result).not.toBeNull()
      expect(result?.zScore).toBe(1.5)
    })
  })
})
