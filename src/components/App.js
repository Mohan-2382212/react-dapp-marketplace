import React, { Component } from 'react';
import Web3 from 'web3';
import Marketplace from '../abis/Marketplace.json';
import './App.css';
import Main from './Main';
import Navbar from './Navbar';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      web3: null,
      account: '',
      productCount: 0,
      products: [],
      loading: true,
      networkId: null,
      error: null,
      marketplace: null
    };
    this.createProduct = this.createProduct.bind(this);
    this.purchaseProduct = this.purchaseProduct.bind(this);
  }

  componentDidMount() {
    this.initializeBlockchain();
  }

  async initializeBlockchain() {
    try {
      // First check if MetaMask is installed
      if (!window.ethereum && !window.web3) {
        this.setState({ 
          error: 'Please install MetaMask to use this dApp!',
          loading: false 
        });
        return;
      }

      // Initialize Web3
      const web3 = new Web3(window.ethereum || window.web3.currentProvider);
      
      try {
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Get the network ID
        const networkId = await web3.eth.net.getId();
        console.log('Network ID:', networkId);

        // Get network data
        const networkData = Marketplace.networks[networkId];
        console.log('Network Data:', networkData);

        if (!networkData) {
          this.setState({ 
            error: `Please connect to Ganache. Contract not deployed on network ${networkId}`,
            loading: false 
          });
          return;
        }

        // Get accounts
        const accounts = await web3.eth.getAccounts();
        console.log('Accounts:', accounts);

        if (accounts.length === 0) {
          this.setState({ 
            error: 'No accounts found! Please connect your MetaMask account.',
            loading: false 
          });
          return;
        }

        // Create contract instance
        const marketplace = new web3.eth.Contract(
          Marketplace.abi,
          networkData.address
        );

        // Verify contract is accessible
        const name = await marketplace.methods.name().call();
        console.log('Marketplace Name:', name);

        // Get product count
        const productCount = await marketplace.methods.productCount().call();
        console.log('Product Count:', productCount);

        // Load products
        const products = [];
        for (let i = 1; i <= productCount; i++) {
          const product = await marketplace.methods.products(i).call();
          products.push(product);
        }

        this.setState({
          web3,
          account: accounts[0],
          networkId,
          marketplace,
          productCount: parseInt(productCount),
          products,
          loading: false,
          error: null
        });

        // Setup event listeners
        window.ethereum.on('accountsChanged', (accounts) => {
          this.setState({ account: accounts[0] });
        });

        window.ethereum.on('chainChanged', () => {
          window.location.reload();
        });

      } catch (error) {
        console.error('MetaMask error:', error);
        this.setState({ 
          error: 'Please unlock MetaMask and refresh the page.',
          loading: false 
        });
      }
    } catch (error) {
      console.error('Blockchain loading error:', error);
      this.setState({ 
        error: 'Error connecting to the blockchain. Please check your network connection.',
        loading: false 
      });
    }
  }

  async createProduct(name, price) {
    try {
      const { marketplace, account } = this.state;
      this.setState({ loading: true, error: null });

      if (!marketplace || !marketplace.methods) {
        throw new Error("Contract not properly initialized");
      }

      console.log("Creating product:", { name, price, account });

      const result = await marketplace.methods
        .createProduct(name, price)
        .send({ 
          from: account,
          gas: 3000000 // Set a fixed gas limit
        });

      console.log("Transaction result:", result);

      // Get the new product
      const productCount = await marketplace.methods.productCount().call();
      const newProduct = await marketplace.methods.products(productCount).call();

      this.setState(prevState => ({
        products: [...prevState.products, newProduct],
        productCount: parseInt(productCount),
        loading: false
      }));

    } catch (error) {
      console.error("Error creating product:", error);
      this.setState({
        loading: false,
        error: error.message || "Failed to create product. Please check your MetaMask and try again."
      });
    }
  }

  async purchaseProduct(id, price) {
    try {
      const { marketplace, account } = this.state;
      this.setState({ loading: true, error: null });

      if (!marketplace || !marketplace.methods) {
        throw new Error("Contract not properly initialized");
      }

      // Convert id to number to ensure proper format
      const productId = parseInt(id);
      
      // Get the product to verify it exists and is available
      const product = await marketplace.methods.products(productId).call();
      
      if (!product) {
        throw new Error("Product not found");
      }
      
      if (product.purchased) {
        throw new Error("Product already purchased");
      }

      if (product.owner.toLowerCase() === account.toLowerCase()) {
        throw new Error("You cannot buy your own product");
      }

      console.log("Purchasing product:", { productId, price, account });

      const result = await marketplace.methods
        .purchaseProduct(productId)
        .send({ 
          from: account, 
          value: price,
          gas: 3000000 // Set a fixed gas limit
        });

      console.log("Purchase transaction result:", result);

      // Update the product in state
      const updatedProduct = await marketplace.methods.products(productId).call();
      this.setState(prevState => ({
        products: prevState.products.map(p => 
          p.id === productId ? updatedProduct : p
        ),
        loading: false
      }));

    } catch (error) {
      console.error("Error purchasing product:", error);
      this.setState({
        loading: false,
        error: error.message || "Failed to purchase product. Please check your ETH balance and try again."
      });
    }
  }

  render() {
    const { loading, error, web3, account, products } = this.state;

    if (error) {
      return (
        <div className="container mt-5">
          <div className="alert alert-danger">
            <h4>Error</h4>
            <p>{error}</p>
            <p>Please ensure:</p>
            <ul>
              <li>MetaMask is installed and unlocked</li>
              <li>You are connected to Ganache (http://127.0.0.1:8545)</li>
              <li>You have imported a Ganache account into MetaMask</li>
              <li>You are connected to the correct network (Chain ID: 1337)</li>
            </ul>
            <button 
              className="btn btn-primary mt-3" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Navbar account={account} />
        <div className="container-fluid mt-5">
          <div className="row">
            <div className="col-lg-12">
              {loading ? (
                <div className="text-center">
                  <p>Loading...</p>
                  <p>Please ensure you are connected to Ganache in MetaMask:</p>
                  <ul className="list-unstyled">
                    <li>Network Name: Ganache</li>
                    <li>RPC URL: http://127.0.0.1:8545</li>
                    <li>Chain ID: 1337</li>
                    <li>Currency Symbol: ETH</li>
                  </ul>
                </div>
              ) : (
                <Main
                  web3={web3}
                  products={products}
                  createProduct={this.createProduct}
                  purchaseProduct={this.purchaseProduct}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
