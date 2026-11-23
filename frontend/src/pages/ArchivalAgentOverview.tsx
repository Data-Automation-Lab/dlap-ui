/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

"use client";

import {
    FeatherActivity,
    FeatherAlertCircle,
    FeatherArchive,
    FeatherCheck,
    FeatherClock,
    FeatherDatabase,
    FeatherDollarSign,
    FeatherPieChart,
    FeatherRefreshCw,
    FeatherSettings,
    FeatherTrendingUp,
    FeatherZap
} from "@subframe/core";
import { useEffect, useState } from "react";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { LineChart } from "../ui/components/LineChart";
import { PieChart } from "../ui/components/PieChart";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { PendingApprovalsNotice } from "../components/ApprovalPanels";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { archivalApi } from "../utils/api";
import {
	NOT_AVAILABLE_YET,
	archivalSavingsFigure,
	archivalStorageFigure,
	isNum,
} from "../utils/apiServices";

// TypeScript interfaces for Archival Agent data
interface IArchivalKpis {
	activePolicies: number;
	assetsIdentified: number;
	assetsArchived: number;
	/** Null when the service sent no figure. See archivalSavingsFigure for zeros. */
	estimatedMonthlySavings: number | null;
	totalSavingsToDate: number | null;
	storageReclaimed: string | null;
	pendingArchival: number;
	failedArchival: number;
	/** Minutes per asset, or null when the service sent none. */
	averageArchivalTime: number | null;
	lastPolicyRun: string;
}

interface ICostSavingsTrend {
	date: string;
	monthlySavings: number;
	cumulativeSavings: number;
	storageReclaimed: number;
}

interface IArchivalStatusData {
	name: string;
	value: number;
	color?: string;
}

interface IRecentActivity {
	id: string;
	event: string;
	assetName: string;
	policy: string;
	storageSize: string;
	savingsAmount: number;
	status: 'Success' | 'Pending' | 'Failed' | 'In Progress';
	timestamp: string;
	details?: string;
}

interface IStorageConsumer {
	name: string;
	currentSize: string;
	lastAccessed: string;
	cost: number;
	recommendation: 'Archive Now' | 'Monitor' | 'Keep Active';
	priority: 'High' | 'Medium' | 'Low';
}

function ArchivalAgentOverview() {
	// State management
	const [kpis, setKpis] = useState<IArchivalKpis | null>(null);
	const [costTrends, setCostTrends] = useState<ICostSavingsTrend[]>([]);
	const [archivalStatusData, setArchivalStatusData] = useState<IArchivalStatusData[]>([]);
	const [recentActivities, setRecentActivities] = useState<IRecentActivity[]>([]);
	const [storageConsumers, setStorageConsumers] = useState<IStorageConsumer[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [refreshing, setRefreshing] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// Real API integration - da-autoarchival ArchivalOverviewController.
	// Base client archivalApi already points at /api/v1/archival; the controller
	// is mapped at /api/v1/archival/overview, so all paths are /overview/*.
	// DTO field names line up 1:1 with the frontend interfaces above.
	const fetchArchivalKpis = async (): Promise<IArchivalKpis> => {
		const { data } = await archivalApi.get('/overview/kpis');
		return {
			activePolicies: data?.activePolicies ?? 0,
			assetsIdentified: data?.assetsIdentified ?? 0,
			assetsArchived: data?.assetsArchived ?? 0,
			estimatedMonthlySavings: isNum(data?.estimatedMonthlySavings) ? data.estimatedMonthlySavings : null,
			totalSavingsToDate: isNum(data?.totalSavingsToDate) ? data.totalSavingsToDate : null,
			storageReclaimed: typeof data?.storageReclaimed === 'string' ? data.storageReclaimed : null,
			pendingArchival: data?.pendingArchival ?? 0,
			failedArchival: data?.failedArchival ?? 0,
			averageArchivalTime: isNum(data?.averageArchivalTime) ? data.averageArchivalTime : null,
			lastPolicyRun: data?.lastPolicyRun ?? 'Never'
		};
	};

	const fetchCostSavingsTrends = async (): Promise<ICostSavingsTrend[]> => {
		const { data } = await archivalApi.get('/overview/trends');
		return Array.isArray(data)
			? data.map((t: Partial<ICostSavingsTrend>) => ({
				date: t?.date ?? '',
				monthlySavings: t?.monthlySavings ?? 0,
				cumulativeSavings: t?.cumulativeSavings ?? 0,
				storageReclaimed: t?.storageReclaimed ?? 0
			}))
			: [];
	};

	const fetchArchivalStatusData = async (): Promise<IArchivalStatusData[]> => {
		const { data } = await archivalApi.get('/overview/status-distribution');
		return Array.isArray(data)
			? data.map((s: Partial<IArchivalStatusData>) => ({
				name: s?.name ?? '',
				value: s?.value ?? 0,
				color: s?.color ?? undefined
			}))
			: [];
	};

	const fetchRecentActivities = async (): Promise<IRecentActivity[]> => {
		const { data } = await archivalApi.get('/overview/recent-activities');
		return Array.isArray(data)
			? data.map((a: Partial<IRecentActivity>, i: number) => ({
				id: a?.id ?? `activity-${i + 1}`,
				event: a?.event ?? '',
				assetName: a?.assetName ?? '',
				policy: a?.policy ?? '',
				storageSize: a?.storageSize ?? '',
				savingsAmount: a?.savingsAmount ?? 0,
				status: (a?.status as IRecentActivity['status']) ?? 'Pending',
				timestamp: a?.timestamp ?? '',
				details: a?.details ?? undefined
			}))
			: [];
	};

	const fetchStorageConsumers = async (): Promise<IStorageConsumer[]> => {
		const { data } = await archivalApi.get('/overview/storage-consumers');
		return Array.isArray(data)
			? data.map((c: Partial<IStorageConsumer>) => ({
				name: c?.name ?? '',
				currentSize: c?.currentSize ?? '',
				lastAccessed: c?.lastAccessed ?? '',
				cost: c?.cost ?? 0,
				recommendation: (c?.recommendation as IStorageConsumer['recommendation']) ?? 'Monitor',
				priority: (c?.priority as IStorageConsumer['priority']) ?? 'Medium'
			}))
			: [];
	};

	// Load all data
	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const [kpisData, trendsData, statusData, activitiesData, consumersData] = await Promise.all([
				fetchArchivalKpis(),
				fetchCostSavingsTrends(),
				fetchArchivalStatusData(),
				fetchRecentActivities(),
				fetchStorageConsumers()
			]);

			setKpis(kpisData);
			setCostTrends(trendsData);
			setArchivalStatusData(statusData);
			setRecentActivities(activitiesData);
			setStorageConsumers(consumersData);
		} catch (error) {
			console.error('Error loading archival data:', error);
			setError('Failed to load archival agent data. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load; loadData is recreated on every render and is also the Retry handler
	}, []);

	// Trigger a real manual archival run, then refetch KPIs + activities so the
	// dashboard reflects the outcome. POST /overview/trigger-run -> Boolean.
	const handleRefresh = async () => {
		setRefreshing(true);
		setError(null);
		try {
			const { data: success } = await archivalApi.post('/overview/trigger-run');
			if (success !== true) {
				throw new Error('Archival run was not accepted by the service.');
			}
			const [kpisData, activitiesData] = await Promise.all([
				fetchArchivalKpis(),
				fetchRecentActivities()
			]);
			setKpis(kpisData);
			setRecentActivities(activitiesData);
		} catch (error) {
			console.error('Error during manual archival run:', error);
			setError('Manual archival run failed. Please try again.');
		} finally {
			setRefreshing(false);
		}
	};

	// Helper functions
	const getStatusVariant = (status: string) => {
		switch (status) {
			case 'Success': return 'success';
			case 'Pending': return 'warning';
			case 'In Progress': return 'brand';
			case 'Failed': return 'error';
			default: return 'neutral';
		}
	};

	const getRecommendationVariant = (recommendation: string) => {
		switch (recommendation) {
			case 'Archive Now': return 'error';
			case 'Monitor': return 'warning';
			case 'Keep Active': return 'success';
			default: return 'neutral';
		}
	};

	const getPriorityVariant = (priority: string) => {
		switch (priority) {
			case 'High': return 'error';
			case 'Medium': return 'warning';
			case 'Low': return 'success';
			default: return 'neutral';
		}
	};

	if (loading) {
		return (
			<DefaultPageLayout>
				<div className="flex h-full w-full items-center justify-center">
					<span className="text-body font-body text-subtext-color">Loading archival agent data...</span>
				</div>
			</DefaultPageLayout>
		);
	}

	if (error || !kpis) {
		return (
			<DefaultPageLayout>
				<div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
					<ErrorState
						message={error || 'Unable to load archival agent information.'}
						onRetry={loadData}
					/>
				</div>
			</DefaultPageLayout>
		);
	}

	// Savings and reclaimed storage are constant zeros on the backend until it
	// aggregates real data; those render as "Not available yet", not as $0.
	const monthlySavings = archivalSavingsFigure(kpis.estimatedMonthlySavings, kpis.assetsArchived);
	const totalSaved = archivalSavingsFigure(kpis.totalSavingsToDate, kpis.assetsArchived);
	const storageReclaimed = archivalStorageFigure(kpis.storageReclaimed, kpis.assetsArchived);
	const avgArchivalMinutes =
		isNum(kpis.averageArchivalTime) && kpis.averageArchivalTime > 0 ? kpis.averageArchivalTime : null;

	return (
		<DefaultPageLayout>
			<div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
				<div className="flex w-full items-start justify-between">
					<div className="flex items-center gap-4">
						<IconWithBackground
							size="large"
							icon={<FeatherArchive />}
							variant="brand"
						/>
						<div className="flex flex-col items-start">
							<span className="text-heading-2 font-heading-2 text-default-font">
								SmartArchival Management
							</span>
							<span className="text-body font-body text-subtext-color">
								Automated Data Archival Agent
							</span>
						</div>
					</div>
					<Button
						variant="neutral-tertiary"
						icon={<FeatherRefreshCw />}
						onClick={handleRefresh}
						loading={refreshing}
						disabled={refreshing}
					>
						{refreshing ? 'Running...' : `Last run: ${kpis.lastPolicyRun}`}
					</Button>
				</div>

				{/* Navigation Tabs */}
				<Tabs>
					<Tabs.Item active={true} icon={<FeatherPieChart />} onClick={() => window.navigateToArchivalAgentOverview?.()}>
						Overview
					</Tabs.Item>
					<Tabs.Item icon={<FeatherSettings />} onClick={() => window.navigateToArchivalAgentPolicyConfiguration?.()}>
						Policy Configuration
					</Tabs.Item>
					<Tabs.Item icon={<FeatherActivity />} onClick={() => window.navigateToArchivalAgentActivity?.()}>
						Archival Activity & Savings
					</Tabs.Item>
				</Tabs>

				<PendingApprovalsNotice actionClasses={['ARCHIVE']} />

				{/* KPI Cards */}
				<div className="grid grid-cols-4 gap-4 w-full">
					<div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
						<div className="flex w-full items-center gap-2">
							<IconWithBackground icon={<FeatherSettings />} variant="brand" />
							<span className="text-body-bold font-body-bold text-subtext-color">
								Active Policies
							</span>
						</div>
						<span className="text-heading-1 font-heading-1 text-default-font">
							{kpis.activePolicies}
						</span>
						{kpis.activePolicies > 0 ? (
							<Badge variant="success" icon={<FeatherCheck />}>
								Archival enabled
							</Badge>
						) : (
							<Badge variant="neutral">Archival disabled</Badge>
						)}
					</div>
					
					<div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
						<div className="flex w-full items-center gap-2">
							<IconWithBackground icon={<FeatherArchive />} variant="success" />
							<span className="text-body-bold font-body-bold text-subtext-color">
								Assets Archived
							</span>
						</div>
						<span className="text-heading-1 font-heading-1 text-default-font">
							{kpis.assetsArchived.toLocaleString()}
						</span>
						<Badge variant="success" icon={<FeatherTrendingUp />}>
							{kpis.pendingArchival} pending
						</Badge>
					</div>
					
					<div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
						<div className="flex w-full items-center gap-2">
							<IconWithBackground icon={<FeatherDollarSign />} variant="warning" />
							<span className="text-body-bold font-body-bold text-subtext-color">
								Monthly Savings
							</span>
						</div>
						{monthlySavings !== null ? (
							<span className="text-heading-1 font-heading-1 text-default-font">
								${monthlySavings.toLocaleString()}
							</span>
						) : (
							<span className="text-heading-3 font-heading-3 text-subtext-color">
								{NOT_AVAILABLE_YET}
							</span>
						)}
						{totalSaved !== null ? (
							<Badge variant="success">
								${totalSaved.toLocaleString()} total saved
							</Badge>
						) : null}
					</div>

					<div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
						<div className="flex w-full items-center gap-2">
							<IconWithBackground icon={<FeatherDatabase />} variant="neutral" />
							<span className="text-body-bold font-body-bold text-subtext-color">
								Storage Reclaimed
							</span>
						</div>
						{storageReclaimed !== null ? (
							<span className="text-heading-1 font-heading-1 text-default-font">
								{storageReclaimed}
							</span>
						) : (
							<span className="text-heading-3 font-heading-3 text-subtext-color">
								{NOT_AVAILABLE_YET}
							</span>
						)}
						{avgArchivalMinutes !== null ? (
							<Badge variant="neutral" icon={<FeatherClock />}>
								Avg {avgArchivalMinutes}min per asset
							</Badge>
						) : null}
					</div>
				</div>

				{/* Charts Section */}
				<div className="flex w-full gap-6">
					{/* Potential Cost Savings Chart */}
					<div className="flex w-2/3 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
						<div className="flex items-center justify-between w-full">
							<span className="text-heading-3 font-heading-3 text-default-font">
								Potential Cost Savings
							</span>
							<Badge variant="neutral">
								Last 7 weeks
							</Badge>
						</div>
						<LineChart
							className="h-64 w-full flex-none"
							data={costTrends.map(trend => ({
								category: trend.date.slice(-5), // Show MM-DD format
								"Monthly Savings": trend.monthlySavings,
								"Cumulative Savings": trend.cumulativeSavings / 10, // Scale down for visibility
								"Storage Reclaimed (TB)": trend.storageReclaimed
							}))}
							index="category"
							categories={["Monthly Savings", "Cumulative Savings", "Storage Reclaimed (TB)"]}
						/>
					</div>

					{/* Data by Archival Status Donut Chart */}
					<div className="flex w-1/3 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
						<div className="flex items-center justify-between w-full">
							<span className="text-heading-3 font-heading-3 text-default-font">
								Data by Archival Status
							</span>
							<Badge variant="neutral">
								Current
							</Badge>
						</div>
						<div className="flex w-full items-center justify-center">
							<PieChart
								className="h-48 w-48 flex-none"
								data={archivalStatusData.map(status => ({
									name: status.name,
									value: status.value
								}))}
								index="name"
								category="value"
							/>
						</div>
						<div className="flex flex-col gap-2 w-full">
							{archivalStatusData.slice(0, 4).map((status) => (
								<div key={status.name} className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<div 
											className="h-3 w-3 rounded-full" 
											style={{ backgroundColor: status.color || '#6b7280' }}
										/>
										<span className="text-body font-body text-subtext-color">
											{status.name}
										</span>
									</div>
									<span className="text-body-bold font-body-bold text-default-font">
										{status.value.toLocaleString()}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Storage Consumers Table */}
				<div className="flex w-full flex-col items-start gap-4">
					<div className="flex items-center justify-between w-full">
						<span className="text-heading-3 font-heading-3 text-default-font">
							Top Storage Consumers
						</span>
					</div>
					{storageConsumers.length === 0 ? (
						<EmptyState
							title="No storage consumers"
							message="The archival agent has not identified any top storage consumers yet."
						/>
					) : (
					<Table
						header={
							<Table.HeaderRow>
								<Table.HeaderCell>Asset Name</Table.HeaderCell>
								<Table.HeaderCell>Current Size</Table.HeaderCell>
								<Table.HeaderCell>Last Accessed</Table.HeaderCell>
								<Table.HeaderCell>Monthly Cost</Table.HeaderCell>
								<Table.HeaderCell>Recommendation</Table.HeaderCell>
								<Table.HeaderCell>Priority</Table.HeaderCell>
							</Table.HeaderRow>
						}
					>
						{storageConsumers.map((consumer, index) => (
							<Table.Row key={index}>
								<Table.Cell>
									<span className="text-body-bold font-body-bold text-default-font">
										{consumer.name}
									</span>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-default-font">
										{consumer.currentSize}
									</span>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-subtext-color">
										{consumer.lastAccessed}
									</span>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-default-font">
										${consumer.cost.toLocaleString()}
									</span>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={getRecommendationVariant(consumer.recommendation)}>
										{consumer.recommendation}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={getPriorityVariant(consumer.priority)}>
										{consumer.priority}
									</Badge>
								</Table.Cell>
							</Table.Row>
						))}
					</Table>
					)}
				</div>

				{/* Recent Activity Log */}
				<div className="flex w-full flex-col items-start gap-4">
					<div className="flex items-center justify-between w-full">
						<span className="text-heading-3 font-heading-3 text-default-font">
							Recent Archival Activity
						</span>
						<Button
							variant="neutral-tertiary"
							size="small"
							onClick={() => window.navigateToArchivalAgentActivity?.()}
						>
							View All Activity
						</Button>
					</div>
					{recentActivities.length === 0 ? (
						<EmptyState
							title="No recent activity"
							message="No archival events have been recorded yet."
						/>
					) : (
					<Table
						header={
							<Table.HeaderRow>
								<Table.HeaderCell>Event</Table.HeaderCell>
								<Table.HeaderCell>Asset</Table.HeaderCell>
								<Table.HeaderCell>Policy</Table.HeaderCell>
								<Table.HeaderCell>Storage Size</Table.HeaderCell>
								<Table.HeaderCell>Savings</Table.HeaderCell>
								<Table.HeaderCell>Status</Table.HeaderCell>
								<Table.HeaderCell>Time</Table.HeaderCell>
							</Table.HeaderRow>
						}
					>
						{recentActivities.map(activity => (
							<Table.Row key={activity.id}>
								<Table.Cell>
									<div className="flex items-center gap-2">
										<IconWithBackground 
											variant={getStatusVariant(activity.status)}
											size="small"
											icon={<FeatherArchive />}
										/>
										<span className="text-body-bold font-body-bold text-default-font">
											{activity.event}
										</span>
									</div>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-default-font">
										{activity.assetName}
									</span>
								</Table.Cell>
								<Table.Cell>
									<Badge variant="neutral">{activity.policy}</Badge>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-subtext-color">
										{activity.storageSize}
									</span>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-default-font">
										${activity.savingsAmount.toLocaleString()}
									</span>
								</Table.Cell>
								<Table.Cell>
									<Badge variant={getStatusVariant(activity.status)} icon={
										activity.status === 'Success' ? <FeatherCheck /> :
										activity.status === 'Pending' ? <FeatherClock /> :
										activity.status === 'In Progress' ? <FeatherZap /> :
										<FeatherAlertCircle />
									}>
										{activity.status}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<span className="text-body font-body text-subtext-color">
										{activity.timestamp}
									</span>
								</Table.Cell>
							</Table.Row>
						))}
					</Table>
					)}
				</div>
			</div>
		</DefaultPageLayout>
	);
}

export default ArchivalAgentOverview; 