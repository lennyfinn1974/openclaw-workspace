'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { getOrders, cancelOrder } from '@/services/api';
import { formatCurrency, formatTime, cn, getSideColor, getOrderStatusColor } from '@/lib/utils';
import { ClipboardList, X } from 'lucide-react';

export function OrdersTable() {
  const { orders, setOrders, updateOrder } = useTradingStore();

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await getOrders();
        setOrders(data);
      } catch (error) {
        console.error('Failed to load orders:', error);
      }
    };

    loadOrders();
  }, []);

  const handleCancel = async (orderId: string) => {
    try {
      const order = await cancelOrder(orderId);
      updateOrder(order);
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'partial');
  const completedOrders = orders.filter((o) => o.status !== 'pending' && o.status !== 'partial');

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-white">Orders</h3>
        {pendingOrders.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-600/20 text-yellow-400 rounded">
            {pendingOrders.length} pending
          </span>
        )}
      </div>

      <div className="overflow-x-auto flex-1">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No orders
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800 sticky top-0 bg-[#0f0f0f]">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium">Symbol</th>
                <th className="text-left px-4 py-2 font-medium">Side</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 20).map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 text-sm"
                >
                  <td className="px-4 py-2 text-gray-400">{formatTime(order.createdAt)}</td>
                  <td className="px-4 py-2 text-white font-medium">{order.symbol}</td>
                  <td className={cn('px-4 py-2 uppercase font-medium', getSideColor(order.side))}>
                    {order.side}
                  </td>
                  <td className="px-4 py-2 text-gray-300 capitalize">{order.type}</td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    {order.filledQuantity > 0
                      ? `${order.filledQuantity}/${order.quantity}`
                      : order.quantity}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    {order.type === 'market'
                      ? 'Market'
                      : formatCurrency(order.price || order.stopPrice || 0)}
                  </td>
                  <td className={cn('px-4 py-2 capitalize', getOrderStatusColor(order.status))}>
                    {order.status}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {(order.status === 'pending' || order.status === 'partial') && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                        title="Cancel order"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
