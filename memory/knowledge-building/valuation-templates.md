# Valuation Templates & Practical Tools

## 1. DCF Model Excel Template Structure

### Sheet 1: Assumptions & Control Panel
```
A. Operating Assumptions
   Revenue Growth Rates:
   Year 1: [Input: 15%]
   Year 2: [Input: 12%]
   Year 3: [Input: 10%]
   Year 4: [Input: 8%]
   Year 5: [Input: 6%]
   Terminal Growth: [Input: 3%]
   
   Margin Profile:
   Gross Margin: [Input: 60%]
   EBITDA Margin Target: [Input: 25%]
   Tax Rate: [Input: 25%]
   
B. Balance Sheet Assumptions
   Days Sales Outstanding: [Input: 45]
   Days Inventory: [Input: 30]
   Days Payable: [Input: 40]
   CapEx as % Revenue: [Input: 5%]
   
C. WACC Inputs
   Risk-Free Rate: [Input: 4.5%]
   Market Risk Premium: [Input: 7%]
   Beta: [Input: 1.2]
   Cost of Debt: [Input: 5%]
   Target D/E Ratio: [Input: 0.4]
```

### Sheet 2: Historical Financials
```
| Metrics | 2021A | 2022A | 2023A | 2024A | 2025A |
|---------|--------|--------|--------|--------|--------|
| Revenue | 850 | 920 | 1,035 | 1,150 | 1,265 |
| YoY Growth | - | 8.2% | 12.5% | 11.1% | 10.0% |
| Gross Profit | 510 | 552 | 621 | 690 | 759 |
| Gross Margin | 60.0% | 60.0% | 60.0% | 60.0% | 60.0% |
| EBITDA | 170 | 193 | 238 | 276 | 316 |
| EBITDA Margin | 20.0% | 21.0% | 23.0% | 24.0% | 25.0% |
| D&A | 42 | 46 | 52 | 58 | 63 |
| EBIT | 128 | 147 | 186 | 218 | 253 |
| CapEx | 43 | 46 | 52 | 58 | 63 |
| NWC | 85 | 92 | 103 | 115 | 127 |
| Change in NWC | - | 7 | 11 | 12 | 12 |
```

### Sheet 3: DCF Calculation
```excel
Formula Structure:

Row 1: Years (1-5 + Terminal)
Row 2: Revenue = Previous Year * (1 + Growth Rate)
Row 3: EBITDA = Revenue * EBITDA Margin
Row 4: D&A = Previous Year * (1 + Revenue Growth * 0.5)
Row 5: EBIT = EBITDA - D&A
Row 6: Tax = EBIT * Tax Rate
Row 7: NOPAT = EBIT - Tax
Row 8: Plus: D&A
Row 9: Less: CapEx = Revenue * CapEx %
Row 10: Less: Change in NWC = (DSO + DIO - DPO) / 365 * Revenue Growth
Row 11: Unlevered FCF = NOPAT + D&A - CapEx - Change in NWC

Row 13: Discount Factor = 1 / (1 + WACC)^Year
Row 14: PV of FCF = FCF * Discount Factor

Terminal Value Calculation:
Terminal FCF = Year 5 FCF * (1 + Terminal Growth)
Terminal Value = Terminal FCF / (WACC - Terminal Growth)
PV of Terminal Value = Terminal Value * Year 5 Discount Factor

Enterprise Value = Sum of PV FCFs + PV Terminal Value
Less: Net Debt
Equity Value = Enterprise Value - Net Debt
Shares Outstanding = [Input]
Price per Share = Equity Value / Shares Outstanding
```

## 2. Comparable Company Analysis Template

### Data Collection Template
```
| Company | Ticker | Market Cap | EV | LTM Revenue | LTM EBITDA | LTM EBIT | Net Income |
|---------|--------|------------|-------|-------------|------------|----------|------------|
| Comp 1 | ABC | $5,000M | $5,500M | $1,000M | $250M | $200M | $150M |
| Comp 2 | DEF | $3,000M | $3,200M | $800M | $160M | $120M | $90M |
| Comp 3 | GHI | $7,000M | $7,800M | $1,200M | $360M | $300M | $210M |
| Comp 4 | JKL | $4,500M | $5,000M | $900M | $225M | $180M | $135M |
| Comp 5 | MNO | $6,000M | $6,500M | $1,100M | $275M | $220M | $165M |

Multiples Calculation:
| Company | EV/Revenue | EV/EBITDA | EV/EBIT | P/E |
|---------|------------|-----------|---------|-----|
| Comp 1 | 5.5x | 22.0x | 27.5x | 33.3x |
| Comp 2 | 4.0x | 20.0x | 26.7x | 33.3x |
| Comp 3 | 6.5x | 21.7x | 26.0x | 33.3x |
| Comp 4 | 5.6x | 22.2x | 27.8x | 33.3x |
| Comp 5 | 5.9x | 23.6x | 29.5x | 36.4x |

Statistical Analysis:
Mean: 5.5x | 21.9x | 27.5x | 33.9x
Median: 5.6x | 22.0x | 27.5x | 33.3x
25th %ile: 5.0x | 20.9x | 26.3x | 33.3x
75th %ile: 6.0x | 22.4x | 27.6x | 33.3x
```

### Adjustments Framework
```
Size Premium/Discount:
If Subject Revenue < 75% of Median Comp → Apply 10% discount
If Subject Revenue > 125% of Median Comp → Apply 5% premium

Growth Adjustment:
Growth Differential = Subject Growth - Comps Median Growth
Multiple Adjustment = Growth Differential × 1.5

Profitability Adjustment:
EBITDA Margin Differential = Subject - Comps Median
Multiple Adjustment = Margin Differential × 0.5
```

## 3. LBO Model Template

### Sources & Uses
```
USES OF FUNDS:
Purchase Enterprise Value: $1,000M (10x EBITDA)
- Equity Rollover: ($100M)
Net Purchase Price: $900M
Transaction Fees (2%): $20M
Financing Fees (1.5%): $9M
Working Capital Adj: $10M
TOTAL USES: $939M

SOURCES OF FUNDS:
Senior Debt (4.0x): $400M
Junior Debt (2.0x): $200M
Total Debt: $600M
Sponsor Equity: $339M
TOTAL SOURCES: $939M

Key Metrics:
Total Leverage: 6.0x
Equity/Total Cap: 36.1%
```

### Returns Analysis
```
Entry (Year 0):
EBITDA: $100M
Multiple: 10.0x
Enterprise Value: $1,000M

Exit (Year 5):
EBITDA: $150M (8.4% CAGR)
Multiple: 11.0x
Enterprise Value: $1,650M

Value Creation Bridge:
EBITDA Growth: $500M
Multiple Expansion: $150M
Total EV Creation: $650M

Plus: Debt Paydown: $200M
Plus: Dividends: $50M
Total Equity Value Creation: $900M

Returns:
Entry Equity: $339M
Exit Equity: $1,239M
IRR: 29.6%
MOIC: 3.65x
```

## 4. Monte Carlo Simulation Implementation

### Excel VBA Implementation
```vba
Function MonteCarloNPV(Iterations As Long) As Variant
    Dim Results() As Double
    ReDim Results(1 To Iterations)
    Dim i As Long
    
    For i = 1 To Iterations
        ' Generate random variables
        Dim RevenueGrowth As Double
        Dim EBITDAMargin As Double
        Dim TerminalGrowth As Double
        Dim DiscountRate As Double
        
        ' Normal distribution for revenue growth (mean=10%, std=3%)
        RevenueGrowth = WorksheetFunction.NormInv(Rnd(), 0.1, 0.03)
        
        ' Beta distribution for EBITDA margin (15%-35% range)
        EBITDAMargin = 0.15 + 0.2 * WorksheetFunction.BetaInv(Rnd(), 2, 5)
        
        ' Triangular distribution for terminal growth (1%-5%, mode=3%)
        TerminalGrowth = TriangularDist(0.01, 0.05, 0.03)
        
        ' Normal distribution for discount rate
        DiscountRate = WorksheetFunction.NormInv(Rnd(), 0.09, 0.015)
        
        ' Calculate NPV with random inputs
        Results(i) = CalculateDCF(RevenueGrowth, EBITDAMargin, _
                                 TerminalGrowth, DiscountRate)
    Next i
    
    ' Return statistics
    Dim Output(1 To 7, 1 To 2) As Variant
    Output(1, 1) = "Mean"
    Output(1, 2) = WorksheetFunction.Average(Results)
    Output(2, 1) = "Std Dev"
    Output(2, 2) = WorksheetFunction.StDev(Results)
    Output(3, 1) = "P10"
    Output(3, 2) = WorksheetFunction.Percentile(Results, 0.1)
    Output(4, 1) = "P50"
    Output(4, 2) = WorksheetFunction.Percentile(Results, 0.5)
    Output(5, 1) = "P90"
    Output(5, 2) = WorksheetFunction.Percentile(Results, 0.9)
    Output(6, 1) = "Min"
    Output(6, 2) = WorksheetFunction.Min(Results)
    Output(7, 1) = "Max"
    Output(7, 2) = WorksheetFunction.Max(Results)
    
    MonteCarloNPV = Output
End Function
```

### Python Implementation
```python
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

class MonteCarloValuation:
    def __init__(self, base_revenue, iterations=10000):
        self.base_revenue = base_revenue
        self.iterations = iterations
        
    def run_simulation(self):
        results = []
        
        for _ in range(self.iterations):
            # Generate random parameters
            revenue_growth = np.random.normal(0.10, 0.03, 5)
            ebitda_margins = np.random.beta(2, 5, 5) * 0.20 + 0.15
            terminal_growth = np.random.triangular(0.01, 0.03, 0.05)
            wacc = np.random.normal(0.09, 0.015)
            
            # Ensure reasonable bounds
            wacc = max(0.05, min(0.15, wacc))
            terminal_growth = min(terminal_growth, wacc - 0.01)
            
            # Calculate valuation
            revenues = [self.base_revenue]
            for g in revenue_growth:
                revenues.append(revenues[-1] * (1 + g))
            
            fcfs = []
            for i in range(1, 6):
                ebitda = revenues[i] * ebitda_margins[i-1]
                tax = ebitda * 0.75 * 0.25  # Approximation
                capex = revenues[i] * 0.05
                nwc_change = (revenues[i] - revenues[i-1]) * 0.1
                fcf = ebitda * 0.75 - tax - capex - nwc_change
                fcfs.append(fcf)
            
            # DCF calculation
            pv_fcfs = sum(fcf / (1 + wacc)**i for i, fcf in enumerate(fcfs, 1))
            terminal_value = fcfs[-1] * (1 + terminal_growth) / (wacc - terminal_growth)
            pv_terminal = terminal_value / (1 + wacc)**5
            
            enterprise_value = pv_fcfs + pv_terminal
            results.append(enterprise_value)
        
        return np.array(results)
    
    def analyze_results(self, results):
        stats_dict = {
            'Mean': np.mean(results),
            'Median': np.median(results),
            'Std Dev': np.std(results),
            'P10': np.percentile(results, 10),
            'P25': np.percentile(results, 25),
            'P75': np.percentile(results, 75),
            'P90': np.percentile(results, 90),
            'Probability < Base Case': (results < np.median(results)).mean()
        }
        
        # Visualization
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Histogram
        ax1.hist(results, bins=100, density=True, alpha=0.7, color='blue')
        ax1.axvline(np.mean(results), color='red', linestyle='--', label='Mean')
        ax1.axvline(np.median(results), color='green', linestyle='--', label='Median')
        ax1.set_xlabel('Enterprise Value ($M)')
        ax1.set_ylabel('Probability Density')
        ax1.set_title('Monte Carlo Simulation Results')
        ax1.legend()
        
        # Cumulative Distribution
        sorted_results = np.sort(results)
        cumulative = np.arange(1, len(sorted_results) + 1) / len(sorted_results)
        ax2.plot(sorted_results, cumulative, color='blue')
        ax2.set_xlabel('Enterprise Value ($M)')
        ax2.set_ylabel('Cumulative Probability')
        ax2.set_title('Cumulative Distribution Function')
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()
        
        return pd.DataFrame([stats_dict]).T
```

## 5. ESG Valuation Adjustment Framework

### ESG Scoring Matrix
```
Environmental Score (0-100):
- Carbon Intensity vs Peers: 30 points
- Renewable Energy %: 20 points
- Waste Management: 20 points
- Water Usage: 15 points
- Environmental Incidents: 15 points

Social Score (0-100):
- Employee Satisfaction: 25 points
- Community Relations: 20 points
- Customer Satisfaction: 20 points
- Supply Chain Labor: 20 points
- Product Safety: 15 points

Governance Score (0-100):
- Board Independence: 30 points
- Executive Compensation: 20 points
- Transparency/Disclosure: 20 points
- Shareholder Rights: 15 points
- Ethics Violations: 15 points
```

### WACC Adjustment Formula
```
ESG-Adjusted WACC = Base WACC + ESG Risk Premium

ESG Risk Premium Calculation:
1. Calculate composite ESG Score (0-100)
2. Determine percentile vs industry peers
3. Apply risk premium:
   - Bottom Quartile: +100 bps
   - Second Quartile: +50 bps
   - Third Quartile: 0 bps
   - Top Quartile: -25 bps
   
4. Additional adjustments:
   - Improving trend: -25 bps
   - Deteriorating trend: +25 bps
   - Major ESG incident: +50-200 bps
```

## 6. Quick Valuation Calculator

### Rule of Thumb Formulas
```
SaaS Companies:
EV = ARR × Multiple
Multiple = 3 + (Growth Rate × 10) + (EBITDA Margin × 5) - (Churn Rate × 20)

E-commerce:
EV = Revenue × (0.5 + Gross Margin + (Growth Rate × 2))

Manufacturing:
EV = EBITDA × (4 + (ROIC/WACC × 2))

Professional Services:
EV = Revenue × (0.8 + (EBITDA Margin × 3))
```

### Football Field Chart Generator
```python
def create_football_field(company_name, valuation_results):
    """
    Create football field chart showing valuation ranges
    
    valuation_results = {
        'DCF': (low, base, high),
        'Trading Comps': (low, median, high),
        'Transaction Comps': (low, median, high),
        'LBO Analysis': (floor_price, expected, ceiling)
    }
    """
    
    methods = list(valuation_results.keys())
    lows = [v[0] for v in valuation_results.values()]
    bases = [v[1] for v in valuation_results.values()]
    highs = [v[2] for v in valuation_results.values()]
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    # Create bars
    y_pos = np.arange(len(methods))
    
    # Plot ranges
    for i, (low, base, high) in enumerate(zip(lows, bases, highs)):
        ax.barh(i, high - low, left=low, height=0.5, 
                color='lightblue', alpha=0.7)
        ax.plot([base, base], [i-0.25, i+0.25], 
                color='darkblue', linewidth=3)
    
    # Formatting
    ax.set_yticks(y_pos)
    ax.set_yticklabels(methods)
    ax.set_xlabel('Enterprise Value ($M)')
    ax.set_title(f'{company_name} - Valuation Summary')
    ax.grid(axis='x', alpha=0.3)
    
    # Add current trading price if public
    # ax.axvline(x=current_price, color='red', linestyle='--', label='Current Price')
    
    plt.tight_layout()
    return fig
```

## 7. Automated Valuation Report Generator

### Report Template Structure
```python
class ValuationReport:
    def __init__(self, company, date):
        self.company = company
        self.date = date
        self.sections = []
    
    def executive_summary(self, valuation_range, recommendation):
        return f"""
        EXECUTIVE SUMMARY
        
        Company: {self.company}
        Date: {self.date}
        
        Valuation Range: ${valuation_range[0]}M - ${valuation_range[1]}M
        Midpoint: ${np.mean(valuation_range)}M
        
        Recommendation: {recommendation}
        
        Key Value Drivers:
        • Revenue growth trajectory
        • Margin expansion opportunity
        • Strategic positioning
        • Management execution
        """
    
    def methodology_section(self):
        return """
        METHODOLOGY
        
        We employed four valuation methodologies:
        
        1. Discounted Cash Flow (40% weight)
           - 5-year explicit forecast period
           - Terminal value using Gordon Growth Model
           - WACC based on CAPM
        
        2. Comparable Company Analysis (30% weight)
           - Selected 8 comparable public companies
           - Applied EV/EBITDA and EV/Revenue multiples
           - Adjusted for size and growth differentials
        
        3. Precedent Transactions (20% weight)
           - Analyzed 12 relevant transactions since 2020
           - Focused on strategic buyer multiples
           - Adjusted for market conditions
        
        4. LBO Analysis (10% weight)
           - Floor valuation based on PE return requirements
           - 25% IRR target
           - 5-year exit assumption
        """
    
    def generate_pdf(self):
        # PDF generation code here
        pass
```

This comprehensive set of templates provides practical tools for implementing the valuation methodologies outlined in the main document.