import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const usersFilePath = path.join(process.cwd(), 'users.json');

type PortfolioItem = {
  symbol: string;
  amount: number;
};

type User = {
  name: string;
  email: string;
  password?: string;
  branch: string;
  enrollment: string;
  eTokens: number;
  portfolio: PortfolioItem[];
};

export async function POST(request: Request) {
  try {
    const { email, action, symbol, amount, price } = await request.json();

    // action: 'buy' | 'sell'
    // symbol: string (e.g., 'BTC', 'AAPL')
    // amount: number of items to trade
    // price: current market price in $ (which equals 1 E-token)

    if (!email || !action || !symbol || amount === undefined || price === undefined || amount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    // Read the current state of users.json
    const data = await fs.readFile(usersFilePath, 'utf-8');
    const users: User[] = JSON.parse(data);

    const userIndex = users.findIndex((u) => u.email === email);

    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[userIndex];
    const totalCost = amount * price; // 1$ = 1 E-token

    // Initialize eTokens and portfolio if they don't exist
    if (user.eTokens === undefined) user.eTokens = 10000;
    if (!user.portfolio) user.portfolio = [];

    if (action === 'buy') {
      if (user.eTokens < totalCost) {
        return NextResponse.json({ error: 'Insufficient E-tokens' }, { status: 400 });
      }

      user.eTokens -= totalCost;

      const assetIndex = user.portfolio.findIndex((p) => p.symbol === symbol);
      if (assetIndex > -1) {
        user.portfolio[assetIndex].amount += amount;
      } else {
        user.portfolio.push({ symbol, amount });
      }
    } else if (action === 'sell') {
      const assetIndex = user.portfolio.findIndex((p) => p.symbol === symbol);
      
      if (assetIndex === -1 || user.portfolio[assetIndex].amount < amount) {
        return NextResponse.json({ error: 'Insufficient assets to sell' }, { status: 400 });
      }

      user.eTokens += totalCost;
      user.portfolio[assetIndex].amount -= amount;

      // Remove asset from portfolio if amount reaches 0
      if (user.portfolio[assetIndex].amount === 0) {
        user.portfolio.splice(assetIndex, 1);
      }
    } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    users[userIndex] = user;

    // Save back the updated state to users.json
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');

    const { password, ...userToReturn } = user;

    return NextResponse.json({ message: 'Trade successful', user: userToReturn }, { status: 200 });
  } catch (error) {
    console.error('Error processing trade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}