/**
 * Currency Conversion Service
 * Provides conversion rates for demo purposes with static prices
 */

class CurrencyService {
  constructor() {
    // Static demo prices in USD (for demo purposes)
    this.staticPrices = {
      ETH: 2500.00,    // $2,500 per ETH
      LSK: 1.25,       // $1.25 per LSK
      USDC: 1.00,      // $1.00 per USDC (stable)
      BTC: 43000.00,   // $43,000 per BTC
      MATIC: 0.85      // $0.85 per MATIC
    };

    // Demo exchange rates to USDC
    this.exchangeRates = {
      ETH_USDC: 2500.00,
      LSK_USDC: 1.25,
      BTC_USDC: 43000.00,
      MATIC_USDC: 0.85,
      USDC_USDC: 1.00
    };

    console.log('💱 Currency Service initialized with demo prices:', this.staticPrices);
  }

  /**
   * Convert ETH amount to USDC equivalent
   * @param {string|number} ethAmount - Amount in ETH
   * @returns {object} Conversion result
   */
  convertEthToUsdc(ethAmount) {
    const eth = parseFloat(ethAmount) || 0;
    const usdcValue = eth * this.exchangeRates.ETH_USDC;

    return {
      fromCurrency: 'ETH',
      toCurrency: 'USDC',
      fromAmount: eth.toFixed(6),
      toAmount: usdcValue.toFixed(2),
      exchangeRate: this.exchangeRates.ETH_USDC,
      timestamp: new Date().toISOString(),
      isDemo: true
    };
  }

  /**
   * Convert LSK amount to USDC equivalent
   * @param {string|number} lskAmount - Amount in LSK
   * @returns {object} Conversion result
   */
  convertLskToUsdc(lskAmount) {
    const lsk = parseFloat(lskAmount) || 0;
    const usdcValue = lsk * this.exchangeRates.LSK_USDC;

    return {
      fromCurrency: 'LSK',
      toCurrency: 'USDC',
      fromAmount: lsk.toFixed(6),
      toAmount: usdcValue.toFixed(2),
      exchangeRate: this.exchangeRates.LSK_USDC,
      timestamp: new Date().toISOString(),
      isDemo: true
    };
  }

  /**
   * Convert any supported currency to USDC
   * @param {string|number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency (ETH, LSK, BTC, etc.)
   * @returns {object} Conversion result
   */
  convertToUsdc(amount, fromCurrency) {
    const upperCurrency = fromCurrency.toUpperCase();
    const numAmount = parseFloat(amount) || 0;

    if (!this.exchangeRates[`${upperCurrency}_USDC`]) {
      throw new Error(`Unsupported currency: ${fromCurrency}`);
    }

    const exchangeRate = this.exchangeRates[`${upperCurrency}_USDC`];
    const usdcValue = numAmount * exchangeRate;

    return {
      fromCurrency: upperCurrency,
      toCurrency: 'USDC',
      fromAmount: numAmount.toFixed(6),
      toAmount: usdcValue.toFixed(2),
      exchangeRate: exchangeRate,
      timestamp: new Date().toISOString(),
      isDemo: true
    };
  }

  /**
   * Get current exchange rates
   * @returns {object} All exchange rates
   */
  getExchangeRates() {
    return {
      rates: this.exchangeRates,
      prices: this.staticPrices,
      timestamp: new Date().toISOString(),
      isDemo: true,
      note: 'These are static demo prices for development purposes'
    };
  }

  /**
   * Get price for a specific currency
   * @param {string} currency - Currency symbol
   * @returns {number} Price in USD
   */
  getPrice(currency) {
    const upperCurrency = currency.toUpperCase();
    return this.staticPrices[upperCurrency] || 0;
  }

  /**
   * Convert wallet balance object to include USDC equivalents
   * @param {object} walletBalance - Wallet balance from API
   * @returns {object} Enhanced wallet balance with USDC values
   */
  enhanceWalletBalance(walletBalance) {
    const enhanced = { ...walletBalance };

    // Add USDC conversion for main wallet ETH
    if (enhanced.mainWallet?.balance) {
      const ethConversion = this.convertEthToUsdc(enhanced.mainWallet.balance);
      enhanced.mainWallet.usdcEquivalent = ethConversion.toAmount;
      enhanced.mainWallet.exchangeRate = ethConversion.exchangeRate;
    }

    // Add USDC conversion for savings wallet ETH
    if (enhanced.savingsWallet?.balance) {
      const ethConversion = this.convertEthToUsdc(enhanced.savingsWallet.balance);
      enhanced.savingsWallet.usdcEquivalent = ethConversion.toAmount;
      enhanced.savingsWallet.exchangeRate = ethConversion.exchangeRate;
    }

    // Calculate total USDC equivalent
    const mainUsdc = parseFloat(enhanced.mainWallet?.usdcEquivalent || 0);
    const savingsUsdc = parseFloat(enhanced.savingsWallet?.usdcEquivalent || 0);
    enhanced.totalUsdcEquivalent = (mainUsdc + savingsUsdc).toFixed(2);

    // Add metadata
    enhanced.conversionInfo = {
      timestamp: new Date().toISOString(),
      ethRate: this.exchangeRates.ETH_USDC,
      isDemo: true,
      note: 'USDC values calculated using static demo rates'
    };

    return enhanced;
  }

  /**
   * Format currency amount for display
   * @param {string|number} amount - Amount to format
   * @param {string} currency - Currency symbol
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted amount
   */
  formatAmount(amount, currency, decimals = 2) {
    const num = parseFloat(amount) || 0;
    const upperCurrency = currency.toUpperCase();

    if (upperCurrency === 'USDC' || upperCurrency === 'USD') {
      return `$${num.toFixed(decimals)}`;
    } else if (upperCurrency === 'ETH') {
      return `${num.toFixed(6)} ETH`;
    } else if (upperCurrency === 'LSK') {
      return `${num.toFixed(6)} LSK`;
    } else {
      return `${num.toFixed(decimals)} ${upperCurrency}`;
    }
  }

  /**
   * Update exchange rates (for future dynamic pricing)
   * @param {object} newRates - New exchange rates
   */
  updateRates(newRates) {
    this.exchangeRates = { ...this.exchangeRates, ...newRates };
    console.log('💱 Exchange rates updated:', newRates);
  }
}

// Create singleton instance
const currencyService = new CurrencyService();

module.exports = currencyService;